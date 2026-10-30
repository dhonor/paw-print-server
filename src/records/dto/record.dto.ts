import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRecordDto {
    @IsString()
    @IsNotEmpty({ message: '缺少宠物 ID' })
    petId: string;

    @IsString()
    @IsNotEmpty({ message: '缺少记录类型' })
    type: string;

    @IsString()
    @IsNotEmpty({ message: '缺少记录日期' })
    date: string;

    @IsOptional() @IsString() value?: string;
    @IsOptional() @IsString() anomaly?: string;
    @IsOptional() @IsString() note?: string;
    @IsOptional() @IsString() operator?: string;
}

export class UpdateRecordDto extends PartialType(CreateRecordDto) {}
