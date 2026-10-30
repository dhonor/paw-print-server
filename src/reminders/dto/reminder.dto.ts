import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateReminderDto {
    @IsString()
    @IsNotEmpty({ message: '缺少宠物 ID' })
    petId: string;

    @IsString()
    @IsNotEmpty({ message: '缺少提醒类型' })
    type: string;

    @IsInt()
    @Min(1)
    cycleDays: number;

    @IsString()
    @IsNotEmpty({ message: '缺少下次日期' })
    nextDate: string;

    @IsOptional() @IsBoolean() enabled?: boolean;
    @IsOptional() @IsString() note?: string;
}

export class UpdateReminderDto extends PartialType(CreateReminderDto) {}
