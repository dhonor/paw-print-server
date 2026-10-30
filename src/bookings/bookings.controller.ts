import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, RateBookingDto, UpdateBookingDto } from './dto/booking.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
    constructor(private readonly bookings: BookingsService) {}

    @Get()
    list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
        return this.bookings.list(user.familyId, status);
    }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
        return this.bookings.create(user.familyId, dto);
    }

    @Patch(':id')
    update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateBookingDto) {
        return this.bookings.update(user.familyId, id, dto);
    }

    @Post(':id/rate')
    rate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RateBookingDto) {
        return this.bookings.rate(user.familyId, id, dto);
    }

    @Delete(':id')
    remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.bookings.remove(user.familyId, id);
    }
}
