import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromocionesNegociosService } from './promociones-negocios.service';
import { PromocionesNegociosController } from './promociones-negocios.controller';

import { PromotionBusiness } from './entities/promotion-business.entity';
import { PromotionBusinessBranch } from './entities/promotion-business-branch.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { Negocio } from '../negocios/entities/negocio.entity';
import { EventosNegociosModule } from '../eventos_negocios/eventos-negocios.module';
import { SuscripcionesModule } from '../../suscripciones/suscripciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromotionBusiness, PromotionBusinessBranch, SucursalNegocio, Negocio]),
    EventosNegociosModule,
    // JLP-QUOTA — necesario para consumirCuota() al crear una promoción.
    SuscripcionesModule,
  ],
  controllers: [PromocionesNegociosController],
  providers: [PromocionesNegociosService],
  exports: [PromocionesNegociosService],
})
export class PromocionesNegociosModule {}