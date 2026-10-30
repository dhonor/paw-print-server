import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

// 统一错误结构：{ statusCode, message, path }
// - HttpException 原样透出可读 message
// - Prisma 的唯一约束/记录不存在映射成 4xx，不再一律 500
// - 500 只记日志，不把堆栈返回给客户端
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('Exception');

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        let status = 500;
        let message: string | string[] = '服务器内部错误';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const payload = exception.getResponse();
            if (typeof payload === 'string') {
                message = payload;
            } else if (payload && typeof payload === 'object') {
                const value = (payload as { message?: string | string[] }).message;
                if (value) {
                    message = value;
                }
            }
        } else {
            // Prisma 已知错误：P2002 唯一冲突、P2025 记录不存在、P2003 外键约束
            const code = (exception as { code?: string })?.code;
            if (code === 'P2002') {
                status = 409;
                message = '数据已存在，请勿重复提交';
            } else if (code === 'P2025') {
                status = 404;
                message = '记录不存在或已被删除';
            } else if (code === 'P2003') {
                status = 400;
                message = '关联数据不存在';
            }
        }

        if (status >= 500) {
            this.logger.error(
                `${request.method} ${request.url} -> ${(exception as Error)?.message || exception}`,
                (exception as Error)?.stack,
            );
        }

        response.status(status).json({
            statusCode: status,
            message: Array.isArray(message) ? message[0] : message,
            path: request.url,
        });
    }
}
