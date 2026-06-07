import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { DeviceToken }      from './entities/device-token.entity';
import { Notification }     from './entities/notification.entity';
import { UserNotification } from './entities/user-notification.entity';
import { Suscriptor }       from '../business/suscriptores/entities/suscriptores.entity';

import { OneSignalService }             from './onesignal.service';
import { NotificationsService }         from './notifications.service';
import { AdminNotificationsService }    from './admin-notifications.service';
import { NotificationsController }      from './notifications.controller';
import { AdminNotificationsController } from './admin-notifications.controller';

// Guards provistos por GuardsModule (global) — no es necesario registrarlos aquí.

@Module({
  imports: [
    HttpModule,  // OneSignalService (llamadas REST a OneSignal API)

    TypeOrmModule.forFeature([
      DeviceToken,
      Notification,
      UserNotification,
      Suscriptor,  // AdminNotificationsService resuelve segmentos por ciudad / role
    ]),
  ],
  controllers: [
    NotificationsController,
    AdminNotificationsController,
  ],
  providers: [
    OneSignalService,
    NotificationsService,
    AdminNotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificacionesModule {}
