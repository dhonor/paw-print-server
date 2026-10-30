import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) {}

    // wx.login 拿到的 code -> openid -> 签发 JWT
    async login(code: string) {
        const openid = await this.resolveOpenid(code);

        let user = await this.prisma.user.findUnique({ where: { openid } });
        if (!user) {
            const family = await this.prisma.family.create({ data: { name: '我的家庭' } });
            user = await this.prisma.user.create({
                data: { openid, familyId: family.id },
            });
        }

        const token = await this.jwt.signAsync({
            sub: user.id,
            openid: user.openid,
            familyId: user.familyId,
        });

        return {
            token,
            user: {
                id: user.id,
                familyId: user.familyId,
                nickname: user.nickname,
            },
        };
    }

    private async resolveOpenid(code: string): Promise<string> {
        const appid = this.config.get<string>('WX_APPID') || '';
        const secret = this.config.get<string>('WX_SECRET') || '';
        const allowMock = (this.config.get<string>('ALLOW_MOCK_LOGIN') || 'true') !== 'false';

        // 本地没配 secret 时走 mock，前端固定传同一个 code 就是同一个用户
        if (!secret) {
            if (!allowMock) {
                throw new UnauthorizedException('服务端未配置 WX_SECRET');
            }
            this.logger.warn('WX_SECRET 未配置，使用 mock openid（仅限本地开发）');
            return 'mock_' + String(code || 'dev');
        }

        const url =
            'https://api.weixin.qq.com/sns/jscode2session' +
            `?appid=${encodeURIComponent(appid)}` +
            `&secret=${encodeURIComponent(secret)}` +
            `&js_code=${encodeURIComponent(code)}` +
            '&grant_type=authorization_code';

        const res = await fetch(url);
        const data = (await res.json()) as { openid?: string; errmsg?: string };

        if (!data.openid) {
            throw new UnauthorizedException(`微信登录失败：${data.errmsg || 'unknown'}`);
        }
        return data.openid;
    }
}
