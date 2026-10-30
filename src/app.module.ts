import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PetsModule } from './pets/pets.module';
import { RecordsModule } from './records/records.module';
import { RemindersModule } from './reminders/reminders.module';
import { BookingsModule } from './bookings/bookings.module';
import { FamiliesModule } from './families/families.module';
import { NotifyModule } from './notify/notify.module';
import { UploadModule } from './upload/upload.module';
import { HealthController } from './health.controller';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
        PetsModule,
        RecordsModule,
        RemindersModule,
        BookingsModule,
        FamiliesModule,
        NotifyModule,
        UploadModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
