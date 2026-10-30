import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReminderDto, UpdateReminderDto } from './dto/reminder.dto';

function addDays(dateStr: string, days: number): string {
    const base = new Date(dateStr);
    const date = Number.isNaN(base.getTime()) ? new Date() : base;
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
    const m = next.getMonth() + 1;
    const d = next.getDate();
    return `${next.getFullYear()}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
}

@Injectable()
export class RemindersService {
    constructor(private readonly prisma: PrismaService) {}

    list(familyId: string, petId?: string) {
        return this.prisma.reminder.findMany({
            where: petId ? { familyId, petId } : { familyId },
            orderBy: { nextDate: 'asc' },
        });
    }

    create(familyId: string, dto: CreateReminderDto) {
        return this.prisma.reminder.create({ data: { ...dto, familyId } });
    }

    async update(familyId: string, id: string, dto: UpdateReminderDto) {
        await this.mustFind(familyId, id);
        return this.prisma.reminder.update({ where: { id }, data: dto });
    }

    async remove(familyId: string, id: string) {
        await this.mustFind(familyId, id);
        await this.prisma.reminder.delete({ where: { id } });
        return { ok: true };
    }

    // 完成一次：按周期顺延下次日期
    async complete(familyId: string, id: string) {
        const reminder = await this.mustFind(familyId, id);
        const nextDate = addDays(reminder.nextDate, reminder.cycleDays);
        return this.prisma.reminder.update({ where: { id }, data: { nextDate } });
    }

    private async mustFind(familyId: string, id: string) {
        const found = await this.prisma.reminder.findFirst({ where: { id, familyId } });
        if (!found) {
            throw new NotFoundException('提醒不存在');
        }
        return found;
    }
}
