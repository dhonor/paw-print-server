import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';
import { RecordsService } from './records.service';

@Controller('records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
    constructor(private readonly records: RecordsService) {}

    @Get()
    list(@CurrentUser() user: AuthUser, @Query('petId') petId?: string, @Query('take') take?: string) {
        return this.records.list(user.familyId, petId, Number(take) || 100);
    }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateRecordDto) {
        return this.records.create(user.familyId, dto);
    }

    @Patch(':id')
    update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRecordDto) {
        return this.records.update(user.familyId, id, dto);
    }

    @Delete(':id')
    remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.records.remove(user.familyId, id);
    }
}
