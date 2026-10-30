import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly jwt: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const header: string = request.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

        if (!token) {
            throw new UnauthorizedException('未登录');
        }

        try {
            request.user = await this.jwt.verifyAsync(token);
            return true;
        } catch (e) {
            throw new UnauthorizedException('登录已过期，请重新进入小程序');
        }
    }
}
