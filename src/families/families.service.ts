import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JoinFamilyDto, RenameFamilyDto, UpdateMeDto } from './dto/family.dto';

@Injectable()
export class FamiliesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
    ) {}

    async detail(userId: string, familyId: string) {
        const family = await this.prisma.family.findUnique({
            where: { id: familyId },
            include: { users: { orderBy: { createdAt: 'asc' } } },
        });
        if (!family) {
            throw new NotFoundException('家庭不存在');
        }
        return {
            id: family.id,
            name: family.name,
            // 家庭 id 就是邀请码：家人拿着它 join 即可共享同一份数据
            inviteCode: family.id,
            members: family.users.map(u => ({
                id: u.id,
                nickname: u.nickname,
                role: u.role,
                avatar: u.avatar,
                isSelf: u.id === userId,
            })),
        };
    }

    async rename(familyId: string, dto: RenameFamilyDto) {
        const family = await this.prisma.family.update({
            where: { id: familyId },
            data: { name: dto.name },
        });
        return { id: family.id, name: family.name };
    }

    async updateMe(userId: string, dto: UpdateMeDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
                ...(dto.role !== undefined ? { role: dto.role } : {}),
                ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
            },
        });
        return { id: user.id, nickname: user.nickname, role: user.role, avatar: user.avatar };
    }

    // 加入邀请码对应的家庭：换家庭后必须换新 token（token 里带了 familyId）
    async join(userId: string, openid: string, currentFamilyId: string, dto: JoinFamilyDto) {
        const inviteCode = (dto.inviteCode || '').trim();
        if (inviteCode === currentFamilyId) {
            throw new BadRequestException('你已经在同一个家庭里');
        }
        const target = await this.prisma.family.findUnique({ where: { id: inviteCode } });
        if (!target) {
            throw new NotFoundException('邀请码无效');
        }
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { familyId: target.id },
        });
        const token = await this.jwt.signAsync({
            sub: user.id,
            openid,
            familyId: user.familyId,
        });
        return { token, familyId: user.familyId, name: target.name };
    }
}
