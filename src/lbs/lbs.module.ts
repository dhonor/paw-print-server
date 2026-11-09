import { Module } from '@nestjs/common';
import { LbsController } from './lbs.controller';
import { LbsService } from './lbs.service';

@Module({
    controllers: [LbsController],
    providers: [LbsService],
})
export class LbsModule {}
