import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

import { BillingSubscription } from './entities/billing-subscription.entity';
import { StripeProcessedEvent } from './entities/stripe-event.entity';

import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Negocio } from '../business/negocios/entities/negocio.entity';
import { Membresia } from '../business/membresias/entities/membresia.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      BillingSubscription,
      StripeProcessedEvent,
      Suscriptor,
      Negocio,
      Membresia,
    ]),
  ],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
