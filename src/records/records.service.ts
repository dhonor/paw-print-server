import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';

@Injectable()
export class RecordsService {
    constructor(private readonly prisma: PrismaService) {}

    list(familyId: string, petId?: string, take = 100) {
        return this.prisma.record.findMany({
            where: petId ? { familyId, petId } : { familyId },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: Math.min(Number(take) || 100, 200),
        });
    }

    create(familyId: string, dto: CreateRecordDto) {
        return this.prisma.record.create({
            data: { ...dto, familyId },
        });
    }

    async update(familyId: string, id: string, dto: UpdateRecordDto) {
        const found = await this.prisma.record.findFirst({ where: { id, familyId } });
        if (!found) {
            throw new NotFoundException('记录不存在');
        }
        return this.prisma.record.update({ where: { id }, data: dto });
    }

    async remove(familyId: string, id: string) {
        const found = await this.prisma.record.findFirst({ where: { id, familyId } });
        if (!found) {
            throw new NotFoundException('记录不存在');
        }
        await this.prisma.record.delete({ where: { id } });
        return { ok: true };
    }
}
