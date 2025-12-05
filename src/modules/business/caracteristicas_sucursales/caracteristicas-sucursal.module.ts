import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { SucursalCaracteristica } from './entities/sucursal-caracteristica.entity';

import { CaracteristicasSucursalService } from './caracteristicas-sucursal.service';
import { SucursalesCaracteristicasService } from './sucursales-caracteristicas.service';

import { CaracteristicasSucursalController } from './caracteristicas-sucursal.controller';
import { SucursalesCaracteristicasController } from './sucursales-caracteristicas.controller';

import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CaracteristicaSucursal,
      SucursalCaracteristica,
      SucursalNegocio,
    ]),
  ],
  controllers: [
    CaracteristicasSucursalController,
    SucursalesCaracteristicasController,
  ],
  providers: [
    CaracteristicasSucursalService,
    SucursalesCaracteristicasService,
  ],
  exports: [
    CaracteristicasSucursalService,
    SucursalesCaracteristicasService,
  ],
})
export class CaracteristicasSucursalModule {}
