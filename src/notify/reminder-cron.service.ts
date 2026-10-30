import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotifyService } from './notify.service';

// 到期提醒的定时扫描：每 30 分钟一次，同一条提醒每天只会推一次
@Injectable()
export class ReminderCronService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ReminderCronService.name);
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly notify: NotifyService) {}

    onModuleInit() {
        // 启动 15 秒后先补一次（服务重启期间到期的也能发出去）
        setTimeout(() => this.tick(), 15000);
        this.timer = setInterval(() => this.tick(), 30 * 60 * 1000);
        this.logger.log('到期提醒定时扫描已启动（间隔 30 分钟）');
    }

    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async tick() {
        try {
            await this.notify.scanDue();
        } catch (err) {
            this.logger.error('到期扫描失败：' + (err && err.message));
        }
    }
}
