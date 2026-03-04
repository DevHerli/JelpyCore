import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromocionesNegociosService } from './promociones-negocios.service';
import { PromocionesNegociosController } from './promociones-negocios.controller';

import { PromotionBusiness } from './entities/promotion-business.entity';
import { PromotionBusinessBranch } from './entities/promotion-business-branch.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromotionBusiness, PromotionBusinessBranch, SucursalNegocio]),
  ],
  controllers: [PromocionesNegociosController],
  providers: [PromocionesNegociosService],
  exports: [PromocionesNegociosService],
})
export class PromocionesNegociosModule {}