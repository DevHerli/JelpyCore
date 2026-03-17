import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';

import { Pago } from './entities/pago.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Membresia } from '../business/membresias/entities/membresia.entity';

import { SuscripcionesModule } from '../suscripciones/suscripciones.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago, Suscriptor, Membresia]),
    SuscripcionesModule, 
    StripeModule,
  ],
  controllers: [PagosController],
  providers: [PagosService],
  exports: [PagosService],
})
export class PagosModule {}