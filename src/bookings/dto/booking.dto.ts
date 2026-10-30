import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export const BOOKING_STATUS = ['待服务', '已完成', '已取消'];

export class CreateBookingDto {
    @IsString()
    @IsNotEmpty({ message: '缺少宠物 ID' })
    petId: string;

    @IsString()
    @IsNotEmpty({ message: '缺少门店名称' })
    placeName: string;

    @IsString()
    @IsNotEmpty({ message: '缺少服务类型' })
    serviceType: string;

    @IsString()
    @IsNotEmpty({ message: '缺少预约日期' })
    date: string;

    @IsString()
    @IsNotEmpty({ message: '缺少预约时段' })
    timeSlot: string;

    @IsOptional() @IsString() placeAddress?: string;
    @IsOptional() @IsString() placeTel?: string;
    @IsOptional() @IsString() note?: string;
    @IsOptional() @IsString() operator?: string;
    @IsOptional() @IsIn(BOOKING_STATUS) status?: string;
}

export class UpdateBookingDto extends PartialType(CreateBookingDto) {}

export class RateBookingDto {
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsOptional() @IsString() review?: string;
}
