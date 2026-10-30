import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { JoinFamilyDto, RenameFamilyDto, UpdateMeDto } from './dto/family.dto';
import { FamiliesService } from './families.service';

@Controller('family')
@UseGuards(JwtAuthGuard)
export class FamiliesController {
    constructor(private readonly families: FamiliesService) {}

    @Get()
    detail(@CurrentUser() user: AuthUser) {
        return this.families.detail(user.sub, user.familyId);
    }

    @Patch()
    rename(@CurrentUser() user: AuthUser, @Body() dto: RenameFamilyDto) {
        return this.families.rename(user.familyId, dto);
    }

    @Patch('me')
    updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
        return this.families.updateMe(user.sub, dto);
    }

    @Post('join')
    join(@CurrentUser() user: AuthUser, @Body() dto: JoinFamilyDto) {
        return this.families.join(user.sub, user.openid, user.familyId, dto);
    }
}
