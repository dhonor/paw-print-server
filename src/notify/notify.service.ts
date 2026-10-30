import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// 订阅消息模板字段有长度限制（thing 类最多 20 个字符）
function cut(value: string, max = 20): string {
    const text = String(value || '');
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function today(): string {
    const d = new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

@Injectable()
export class NotifyService {
    private readonly logger = new Logger(NotifyService.name);
    private tokenCache = { value: '', expireAt: 0 };

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    // 用户在页面上点了「允许」之后，后端记一次可发送额度
    async subscribe(userId: string, count: number) {
        const times = Math.max(1, Math.min(Number(count) || 1, 10));
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { subscribeCount: { increment: times } },
        });
        return { subscribeCount: user.subscribeCount };
    }

    private get templateId(): string {
        return this.config.get<string>('WX_SUBSCRIBE_TEMPLATE_ID') || '';
    }

    private async getAccessToken(): Promise<string> {
        const appid = this.config.get<string>('WX_APPID') || '';
        const secret = this.config.get<string>('WX_SECRET') || '';
        if (!appid || !secret) {
            return '';
        }
        const now = Date.now();
        if (this.tokenCache.value && this.tokenCache.expireAt > now) {
            return this.tokenCache.value;
        }
        const url =
            'https://api.weixin.qq.com/cgi-bin/token' +
            `?grant_type=client_credential&appid=${encodeURIComponent(appid)}` +
            `&secret=${encodeURIComponent(secret)}`;
        const res = await fetch(url);
        const data = (await res.json()) as { access_token?: string; expires_in?: number };
        if (!data.access_token) {
            this.logger.error('获取 access_token 失败：' + JSON.stringify(data));
            return '';
        }
        this.tokenCache = {
            value: data.access_token,
            // 提前 5 分钟过期，避免边界失败
            expireAt: now + ((data.expires_in || 7200) - 300) * 1000,
        };
        return data.access_token;
    }

    // 发一条提醒；没配模板 ID 时走 mock，只打日志，方便本地验证链路
    async sendReminder(
        openid: string,
        payload: { petName: string; type: string; nextDate: string },
    ): Promise<{ ok: boolean; mock?: boolean; error?: string }> {
        const templateId = this.templateId;
        if (!templateId) {
            this.logger.log(
                `[mock] 提醒推送 -> ${openid} | ${payload.petName} · ${payload.type} · ${payload.nextDate}`,
            );
            return { ok: true, mock: true };
        }

        const token = await this.getAccessToken();
        if (!token) {
            return { ok: false, error: 'access_token 获取失败' };
        }

        const body = {
            touser: openid,
            template_id: templateId,
            page: 'pages/reminders/reminders',
            data: {
                thing1: { value: cut(payload.petName) },
                thing2: { value: cut(payload.type) },
                time3: { value: payload.nextDate },
                thing4: { value: cut('该给毛孩子做护理了') },
            },
        };

        const res = await fetch(
            `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            },
        );
        const data = (await res.json()) as { errcode: number; errmsg: string };
        if (data.errcode === 0) {
            return { ok: true };
        }
        this.logger.warn('订阅消息发送失败：' + JSON.stringify(data));
        return { ok: false, error: data.errmsg };
    }

    // 扫描今天到期（含逾期）的提醒，给家庭成员逐个推送
    async scanDue(day = today()) {
        const due = await this.prisma.reminder.findMany({
            where: {
                enabled: true,
                nextDate: { lte: day },
                lastNotifiedDate: { not: day },
            },
            include: {
                pet: true,
                family: { include: { users: true } },
            },
            take: 200,
        });

        const result = { day, scanned: due.length, sent: 0, mock: 0, skipped: 0, failed: 0 };

        for (const reminder of due) {
            for (const user of reminder.family.users) {
                if (user.subscribeCount <= 0) {
                    result.skipped += 1;
                    continue;
                }
                const out = await this.sendReminder(user.openid, {
                    petName: reminder.pet.name,
                    type: reminder.type,
                    nextDate: reminder.nextDate,
                });
                if (out.ok) {
                    result.sent += 1;
                    if (out.mock) {
                        result.mock += 1;
                    }
                    await this.prisma.user.update({
                        where: { id: user.id },
                        data: { subscribeCount: { decrement: 1 } },
                    });
                } else {
                    result.failed += 1;
                }
            }
            await this.prisma.reminder.update({
                where: { id: reminder.id },
                data: { lastNotifiedDate: day },
            });
        }

        if (result.scanned > 0) {
            this.logger.log(
                `到期提醒扫描完成：扫描 ${result.scanned} 条，发送 ${result.sent}（mock ${result.mock}），跳过 ${result.skipped}，失败 ${result.failed}`,
            );
        }
        return result;
    }
}
