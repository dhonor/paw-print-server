import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { NotifyService } from './notify.service';

@Controller('notify')
@UseGuards(JwtAuthGuard)
export class NotifyController {
    constructor(private readonly notify: NotifyService) {}

    // 用户在 wx.requestSubscribeMessage 里点了「允许」后调用
    @Post('subscribe')
    subscribe(@CurrentUser() user: AuthUser, @Body() body: { count?: number }) {
        return this.notify.subscribe(user.sub, Number(body && body.count) || 1);
    }

    // 手动触发一次到期扫描，方便本地验证（线上由定时任务负责）
    @Post('run')
    run() {
        return this.notify.scanDue();
    }
}
