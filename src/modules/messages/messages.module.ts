import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { BusinessMessage } from './entities/business-message.entity';
import { Suscriptor }      from '../business/suscriptores/entities/suscriptores.entity';

import { MessagesService }         from './messages.service';
import { AdminMessagesService }    from './admin-messages.service';
import { MessagesController }      from './messages.controller';
import { AdminMessagesController } from './admin-messages.controller';
import { MessagesJwtAuthGuard }    from './guards/jwt-auth.guard';
import { ApiKeyGuard }             from './guards/api-key.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessMessage,
      Suscriptor,   // necesario para AdminMessagesService (resolver segmentos por ciudad)
    ]),

    // JWT para verificar tokens de suscriptores (app móvil)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject:  [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [
    MessagesController,       // app móvil  → protegido por JWT suscriptores
    AdminMessagesController,  // Jelpy System → protegido por API Key
  ],
  providers: [
    MessagesJwtAuthGuard,  // guard JWT para /messages/*
    ApiKeyGuard,           // guard API Key para /admin/messages/*
    MessagesService,
    AdminMessagesService,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
