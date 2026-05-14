import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BusinessMessage } from './entities/business-message.entity';
import { Suscriptor }      from '../business/suscriptores/entities/suscriptores.entity';

import { MessagesService }          from './messages.service';
import { AdminMessagesService }     from './admin-messages.service';
import { MessagesController }       from './messages.controller';
import { AdminMessagesController }  from './admin-messages.controller';
import { MessagesJwtAuthGuard }     from './guards/jwt-auth.guard';
import { MessagesAdminGuard }       from './guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessMessage,
      Suscriptor,       // necesario para MessagesAdminGuard (verifica role en BD)
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
    MessagesController,
    AdminMessagesController,
  ],
  providers: [
    // Guards
    MessagesJwtAuthGuard,
    MessagesAdminGuard,

    // Servicios
    MessagesService,
    AdminMessagesService,
  ],
  /**
   * MessagesService exportado para que otros módulos (pagos, membresías, etc.)
   * puedan inyectarlo y crear mensajes internos:
   *   await this.messagesService.createMessage({ subscriberId, type, title, ... })
   */
  exports: [MessagesService],
})
export class MessagesModule {}
