import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RenameFamilyDto {
    @IsString()
    @IsNotEmpty({ message: '家庭名称不能为空' })
    @MaxLength(20)
    name: string;
}

export class UpdateMeDto {
    @IsOptional() @IsString() @MaxLength(20) nickname?: string;
    @IsOptional() @IsString() @MaxLength(10) role?: string;
    // 头像地址：上传接口返回的 url，或预设头像键
    @IsOptional() @IsString() @MaxLength(500) avatar?: string;
}

export class JoinFamilyDto {
    @IsString()
    @IsNotEmpty({ message: '缺少邀请码' })
    inviteCode: string;
}
