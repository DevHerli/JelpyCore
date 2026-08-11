import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Negocio } from './entities/negocio.entity';
import { NegociosService } from './negocios.service';
import { NegociosController } from './negocios.controller';
import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';
import { KeywordTaxonomia } from '../../core/taxonomia/entities/keyword-taxonomia.entity';
import { BillingModule } from '../../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Negocio, Suscriptor, KeywordTaxonomia]),
    BillingModule,
  ],
  controllers: [NegociosController],
  providers: [NegociosService],
  exports: [NegociosService],
})
export class NegociosModule {}
