import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateReminderDto, UpdateReminderDto } from './dto/reminder.dto';
import { RemindersService } from './reminders.service';

@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
    constructor(private readonly reminders: RemindersService) {}

    @Get()
    list(@CurrentUser() user: AuthUser, @Query('petId') petId?: string) {
        return this.reminders.list(user.familyId, petId);
    }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateReminderDto) {
        return this.reminders.create(user.familyId, dto);
    }

    @Patch(':id')
    update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateReminderDto) {
        return this.reminders.update(user.familyId, id, dto);
    }

    @Post(':id/complete')
    complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.reminders.complete(user.familyId, id);
    }

    @Delete(':id')
    remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.reminders.remove(user.familyId, id);
    }
}
