import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { SucursalNegocio } from '../../business/sucursales_negocios/entities/sucursal-negocio.entity';
import { HorarioSucursal } from '../../business/horario_sucursal/entities/horarios-sucursal.entity';

import { PublicSucursalesService } from './public-sucursales.service';
import { PublicSucursalesController } from './public-sucursales.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SucursalNegocio, HorarioSucursal]),
  ],
  providers: [PublicSucursalesService],
  controllers: [PublicSucursalesController],
})
export class PublicSucursalesModule {}
