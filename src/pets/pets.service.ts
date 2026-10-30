import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';

@Injectable()
export class PetsService {
    constructor(private readonly prisma: PrismaService) {}

    list(familyId: string) {
        return this.prisma.pet.findMany({
            where: { familyId },
            orderBy: { createdAt: 'desc' },
        });
    }

    show(familyId: string, id: string) {
        return this.prisma.pet.findFirst({ where: { id, familyId } });
    }

    create(familyId: string, dto: CreatePetDto) {
        return this.prisma.pet.create({
            data: { ...dto, familyId },
        });
    }

    async update(familyId: string, id: string, dto: UpdatePetDto) {
        const found = await this.prisma.pet.findFirst({ where: { id, familyId } });
        if (!found) {
            throw new NotFoundException('宠物不存在');
        }
        return this.prisma.pet.update({ where: { id }, data: dto });
    }

    async remove(familyId: string, id: string) {
        const found = await this.prisma.pet.findFirst({ where: { id, familyId } });
        if (!found) {
            throw new NotFoundException('宠物不存在');
        }
        await this.prisma.pet.delete({ where: { id } });
        return { ok: true };
    }
}
