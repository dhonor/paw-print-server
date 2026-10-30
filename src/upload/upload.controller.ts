import {
    BadRequestException,
    Controller,
    Post,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

// 开发阶段直接存本地磁盘；生产建议换对象存储（COS / OSS）
const UPLOAD_DIR = join(process.cwd(), 'uploads');

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
    @Post()
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (_req, _file, cb) => {
                    if (!existsSync(UPLOAD_DIR)) {
                        mkdirSync(UPLOAD_DIR, { recursive: true });
                    }
                    cb(null, UPLOAD_DIR);
                },
                filename: (_req, file, cb) => {
                    const ext = extname(file.originalname || '') || '.jpg';
                    cb(null, `${randomUUID()}${ext}`);
                },
            }),
            limits: { fileSize: 5 * 1024 * 1024 },
            fileFilter: (_req, file, cb) => {
                if (!/^image\//.test(file.mimetype || '')) {
                    cb(new BadRequestException('只支持图片文件'), false);
                    return;
                }
                cb(null, true);
            },
        }),
    )
    upload(@UploadedFile() file: any, @Req() req: any) {
        if (!file) {
            throw new BadRequestException('没有收到文件');
        }
        // 用请求的 host 拼完整地址：模拟器是 127.0.0.1，真机是局域网 IP，都能直接用
        const host = req.headers.host || '127.0.0.1:4000';
        return {
            url: `http://${host}/uploads/${file.filename}`,
            path: `/uploads/${file.filename}`,
            size: file.size,
        };
    }
}
