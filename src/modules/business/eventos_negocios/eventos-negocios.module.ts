import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventosNegociosController } from './eventos-negocios.controller';
import { EventosNegociosService } from './eventos-negocios.service';
import { EventoNegocio } from './entities/evento-negocio.entity';
import { LecturaEventoNegocio } from './entities/lectura-evento-negocio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventoNegocio,
      LecturaEventoNegocio,
    ]),
  ],
  controllers: [EventosNegociosController],
  providers: [EventosNegociosService],
  exports: [EventosNegociosService],
})
export class EventosNegociosModule {}