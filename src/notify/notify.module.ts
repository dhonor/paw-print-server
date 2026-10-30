import { Module } from '@nestjs/common';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';
import { ReminderCronService } from './reminder-cron.service';

@Module({
    controllers: [NotifyController],
    providers: [NotifyService, ReminderCronService],
    exports: [NotifyService],
})
export class NotifyModule {}
