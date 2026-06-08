import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { CaracteristicaAplicabilidad } from './entities/caracteristicas-aplicabilidad.entity';
import { SucursalCaracteristica } from './entities/sucursal-caracteristica.entity';

import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

import { CaracteristicasSucursalService } from './caracteristicas-sucursal.service';
import { SucursalesCaracteristicasService } from './sucursales-caracteristicas.service';

import { CaracteristicasSucursalController } from './caracteristicas-sucursal.controller';
import { SucursalesCaracteristicasController } from './sucursales-caracteristicas.controller';
import { CaracteristicaAlias } from './entities/caracteristica-alias.entity';
import { CaracteristicasAliasesController } from './caracteristicas-aliases.controller';
import { CaracteristicasAliasesService } from './caracteristicas-aliases.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CaracteristicaSucursal,
      CaracteristicaAplicabilidad,
      SucursalCaracteristica,
      SucursalNegocio,
      CaracteristicaAlias,
    ]),
  ],
  controllers: [
    CaracteristicasSucursalController,
    SucursalesCaracteristicasController,
    CaracteristicasAliasesController,
  ],
  providers: [
    CaracteristicasSucursalService,
    SucursalesCaracteristicasService,
    CaracteristicasAliasesService,
  ],
  exports: [
    CaracteristicasSucursalService,
    SucursalesCaracteristicasService,
    CaracteristicasAliasesService,
    TypeOrmModule,
  ],
})
export class CaracteristicasSucursalModule {}