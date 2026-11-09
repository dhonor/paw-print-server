import {
    BadGatewayException,
    BadRequestException,
    HttpException,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SearchParams {
    keyword: string;
    latitude: number;
    longitude: number;
    radius: number;
    pageSize: number;
}

// 腾讯位置服务代理。
// 小程序直连 apis.map.qq.com 会把 WebServiceAPI key 暴露在客户端，这里统一由服务端转发，
// key 只存在 .env 的 LBS_KEY 里，并且接口要求登录态（JwtAuthGuard）。
@Injectable()
export class LbsService {
    private readonly logger = new Logger(LbsService.name);

    constructor(private readonly config: ConfigService) {}

    private get key(): string {
        return this.config.get<string>('LBS_KEY') || '';
    }

    async search(params: SearchParams) {
        this.assertCoords(params.latitude, params.longitude);
        const pageSize = Math.min(Math.max(params.pageSize || 20, 1), 20);
        return this.call('/ws/place/v1/search', {
            keyword: params.keyword || '',
            // nearby(中心点纬度,经度,半径,是否自动扩大范围)
            boundary: `nearby(${params.latitude},${params.longitude},${params.radius || 5000},1)`,
            orderby: '_distance',
            page_size: String(pageSize),
            page_index: '1',
            output: 'json',
        });
    }

    async geocode(latitude: number, longitude: number) {
        this.assertCoords(latitude, longitude);
        return this.call('/ws/geocoder/v1/', {
            location: `${latitude},${longitude}`,
            get_poi: '0',
        });
    }

    private assertCoords(latitude: number, longitude: number) {
        const valid =
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            Math.abs(latitude) <= 90 &&
            Math.abs(longitude) <= 180;
        if (!valid) {
            throw new BadRequestException('缺少有效的经纬度');
        }
    }

    // 透传腾讯的原始响应结构（{ status, message, data }），小程序侧照旧做字段映射
    private async call(path: string, params: Record<string, string>) {
        const key = this.key;
        if (!key) {
            throw new ServiceUnavailableException('服务端未配置 LBS_KEY');
        }
        const query = new URLSearchParams({ ...params, key });
        const url = `https://apis.map.qq.com${path}?${query.toString()}`;

        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            const body = (await response.json()) as { status?: number; message?: string };
            if (!response.ok) {
                throw new BadGatewayException(body.message || `位置服务返回 ${response.status}`);
            }
            if (body.status !== 0) {
                throw new BadGatewayException(body.message || '位置服务请求失败');
            }
            return body;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.logger.warn(`LBS 请求失败：${(error as Error)?.message || error}`);
            throw new BadGatewayException('位置服务暂时不可用，请稍后重试');
        }
    }
}
