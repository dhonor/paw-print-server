import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateFeedbackDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
    constructor(private readonly feedback: FeedbackService) {}

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateFeedbackDto) {
        return this.feedback.create(user.sub, user.familyId, dto);
    }

    @Get('mine')
    mine(@CurrentUser() user: AuthUser) {
        return this.feedback.listMine(user.sub);
    }
}
