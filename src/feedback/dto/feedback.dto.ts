import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const FEEDBACK_TYPES = ['功能建议', '问题反馈', '内容错误', '其他'];

export class CreateFeedbackDto {
    @IsOptional()
    @IsIn(FEEDBACK_TYPES, { message: '反馈类型不合法' })
    type?: string;

    @IsString()
    @IsNotEmpty({ message: '请填写反馈内容' })
    @MinLength(5, { message: '内容太短了，请至少写 5 个字' })
    @MaxLength(500, { message: '内容最多 500 字' })
    content: string;

    @IsOptional()
    @IsString()
    @MaxLength(60)
    contact?: string;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(3, { message: '最多上传 3 张图片' })
    images?: string[];
}
