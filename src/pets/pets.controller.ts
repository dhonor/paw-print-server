import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreatePetDto, UpdatePetDto } from './dto/pet.dto';
import { PetsService } from './pets.service';

@Controller('pets')
@UseGuards(JwtAuthGuard)
export class PetsController {
    constructor(private readonly pets: PetsService) {}

    @Get()
    list(@CurrentUser() user: AuthUser) {
        return this.pets.list(user.familyId);
    }

    @Get(':id')
    show(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.pets.show(user.familyId, id);
    }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreatePetDto) {
        return this.pets.create(user.familyId, dto);
    }

    @Patch(':id')
    update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePetDto) {
        return this.pets.update(user.familyId, id, dto);
    }

    @Delete(':id')
    remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
        return this.pets.remove(user.familyId, id);
    }
}
