import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BusinessMessage } from './entities/business-message.entity';
import { Suscriptor }      from '../business/suscriptores/entities/suscriptores.entity';

import { MessagesService }         from './messages.service';
import { AdminMessagesService }    from './admin-messages.service';
import { MessagesController }      from './messages.controller';
import { AdminMessagesController } from './admin-messages.controller';

// Guards provistos por GuardsModule (global) — no es necesario registrarlos aquí.

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessMessage,
      Suscriptor,  // AdminMessagesService resuelve segmentos por ciudad
    ]),
  ],
  controllers: [
    MessagesController,       // app móvil  → protegido por JwtAuthGuard
    AdminMessagesController,  // Jelpy System → protegido por ApiKeyGuard
  ],
  providers: [
    MessagesService,
    AdminMessagesService,
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
