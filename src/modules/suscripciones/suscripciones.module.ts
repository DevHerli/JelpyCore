import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SuscripcionesService } from './suscripciones.service';
import { SuscripcionesController } from './suscripciones.controller';

import { SuscriptorSuscripcion } from './entities/suscriptor-suscripcion.entity';
import { SuscripcionCiclo } from './entities/suscripcion-ciclo.entity';
import { MembresiaCuotas } from './entities/membresia-cuotas.entity';
import { EstadoCuentaMovimiento } from './entities/estado-cuenta-movimiento.entity';

import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Membresia } from '../business/membresias/entities/membresia.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SuscriptorSuscripcion,
      SuscripcionCiclo,
      MembresiaCuotas,
      EstadoCuentaMovimiento,
      Suscriptor,
      Membresia,
    ]),
  ],
  controllers: [SuscripcionesController],
  providers: [SuscripcionesService],
  exports: [SuscripcionesService], 
})
export class SuscripcionesModule {}