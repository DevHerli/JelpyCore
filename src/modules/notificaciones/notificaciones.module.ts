import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DeviceToken }      from './entities/device-token.entity';
import { Notification }     from './entities/notification.entity';
import { UserNotification } from './entities/user-notification.entity';
import { Suscriptor }       from '../business/suscriptores/entities/suscriptores.entity';

import { OneSignalService }             from './onesignal.service';
import { NotificationsService }         from './notifications.service';
import { AdminNotificationsService }    from './admin-notifications.service';
import { NotificationsController }      from './notifications.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { JwtAuthGuard }                 from './guards/jwt-auth.guard';
import { AdminGuard }                   from './guards/admin.guard';

@Module({
  imports: [
    HttpModule,   // para OneSignalService (llamadas REST a OneSignal API)

    TypeOrmModule.forFeature([
      DeviceToken,
      Notification,
      UserNotification,
      Suscriptor,   // necesario para AdminGuard (verifica role en DB)
    ]),

    // Mismo secret que AuthModule para verificar tokens existentes
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [
    NotificationsController,
    AdminNotificationsController,
  ],
  providers: [
    // Guards registrados como providers para que @UseGuards() resuelva el DI
    JwtAuthGuard,
    AdminGuard,

    // Servicios
    OneSignalService,
    NotificationsService,
    AdminNotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificacionesModule {}
