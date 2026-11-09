import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { LbsService } from './lbs.service';

@Controller('lbs')
@UseGuards(JwtAuthGuard)
export class LbsController {
    constructor(private readonly lbs: LbsService) {}

    // 周边搜索：/api/lbs/search?keyword=宠物医院&latitude=..&longitude=..&radius=5000
    @Get('search')
    search(
        @Query('keyword') keyword = '',
        @Query('latitude') latitude?: string,
        @Query('longitude') longitude?: string,
        @Query('radius') radius?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.lbs.search({
            keyword,
            latitude: Number(latitude),
            longitude: Number(longitude),
            radius: Number(radius) || 5000,
            pageSize: Number(pageSize) || 20,
        });
    }

    // 逆地址解析：/api/lbs/geocode?latitude=..&longitude=..
    @Get('geocode')
    geocode(@Query('latitude') latitude?: string, @Query('longitude') longitude?: string) {
        return this.lbs.geocode(Number(latitude), Number(longitude));
    }
}
