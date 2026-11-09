import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    app.setGlobalPrefix('api');
    app.enableCors();

    // 简易请求日志：排查「小程序请求到底有没有打到后端」时最有用
    app.use((req: any, res: any, next: () => void) => {
        const start = Date.now();
        res.on('finish', () => {
            // eslint-disable-next-line no-console
            console.log(
                `[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.originalUrl} ` +
                    `${res.statusCode} ${Date.now() - start}ms`,
            );
        });
        next();
    });

    // 统一错误结构：{ statusCode, message, path }，前端可以直接展示 message
    app.useGlobalFilters(new AllExceptionsFilter());
    // 上传的图片直接对外暴露：http://host/uploads/xxx.jpg
    // 注意静态资源不走 /api 前缀
    app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: false,
        }),
    );

    const port = Number(process.env.PORT || 4000);
    // 不显式绑定 0.0.0.0：Node 会监听 ::（IPv6）并接受 IPv4 映射，
    // 这样 localhost（可能解析到 ::1）和 127.0.0.1 都能访问
    await app.listen(port);
    // eslint-disable-next-line no-console
    console.log(`[paw-print-server] listening on http://localhost:${port}/api`);
}

bootstrap();
