import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/feedback.dto';

@Injectable()
export class FeedbackService {
    constructor(private readonly prisma: PrismaService) {}

    async create(userId: string, familyId: string, dto: CreateFeedbackDto) {
        const feedback = await this.prisma.feedback.create({
            data: {
                userId,
                familyId,
                type: dto.type || '功能建议',
                content: dto.content.trim(),
                contact: (dto.contact || '').trim(),
                images: (dto.images || []).join(','),
            },
        });
        return { id: feedback.id, createdAt: feedback.createdAt };
    }

    // 用户查看自己提交过的反馈
    listMine(userId: string) {
        return this.prisma.feedback.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, type: true, content: true, status: true, createdAt: true },
        });
    }
}
