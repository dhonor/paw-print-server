import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePetDto {
    @IsString()
    @IsNotEmpty({ message: '宠物昵称不能为空' })
    name: string;

    @IsOptional() @IsString() species?: string;
    @IsOptional() @IsString() breed?: string;
    @IsOptional() @IsString() gender?: string;
    @IsOptional() @IsString() birthday?: string;
    @IsOptional() @IsString() avatar?: string;
    @IsOptional() @IsString() note?: string;
    @IsOptional() @IsString() microchip?: string;
    @IsOptional() @IsString() emergencyContact?: string;
    @IsOptional() @IsString() sterilized?: string;
    @IsOptional() @IsString() noseprintCode?: string;
    @IsOptional() @IsString() noseprintAt?: string;
    @IsOptional() noseprintQuality?: number;
}

export class UpdatePetDto extends PartialType(CreatePetDto) {}
