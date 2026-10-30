import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto, RateBookingDto, UpdateBookingDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
    constructor(private readonly prisma: PrismaService) {}

    list(familyId: string, status?: string) {
        return this.prisma.booking.findMany({
            where: status ? { familyId, status } : { familyId },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });
    }

    create(familyId: string, dto: CreateBookingDto) {
        return this.prisma.booking.create({ data: { ...dto, familyId } });
    }

    async update(familyId: string, id: string, dto: UpdateBookingDto) {
        await this.mustFind(familyId, id);
        return this.prisma.booking.update({ where: { id }, data: dto });
    }

    // 评价：只有「已完成」的单可以评价
    async rate(familyId: string, id: string, dto: RateBookingDto) {
        const booking = await this.mustFind(familyId, id);
        if (booking.status !== '已完成') {
            throw new BadRequestException('服务完成之后才能评价');
        }
        return this.prisma.booking.update({
            where: { id },
            data: { rating: dto.rating, review: dto.review || '' },
        });
    }

    async remove(familyId: string, id: string) {
        await this.mustFind(familyId, id);
        await this.prisma.booking.delete({ where: { id } });
        return { ok: true };
    }

    private async mustFind(familyId: string, id: string) {
        const found = await this.prisma.booking.findFirst({ where: { id, familyId } });
        if (!found) {
            throw new NotFoundException('预约不存在');
        }
        return found;
    }
}
