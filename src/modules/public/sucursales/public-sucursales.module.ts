import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { SucursalNegocio } from '../../business/sucursales_negocios/entities/sucursal-negocio.entity';
import { HorarioSucursal } from '../../business/horario_sucursal/entities/horarios-sucursal.entity';
import { EstadisticaSucursalHistorico } from '../../core/metrics/estadisticas-sucursales-historico/entities/estadistica-sucursal-historico.entity';
import { SucursalLike } from '../../core/sucursal-likes/entities/sucursal-like.entity';

import { PublicSucursalesService } from './public-sucursales.service';
import { PublicSucursalesController } from './public-sucursales.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SucursalNegocio, HorarioSucursal, EstadisticaSucursalHistorico, SucursalLike]),
  ],
  providers: [PublicSucursalesService],
  controllers: [PublicSucursalesController],
})
export class PublicSucursalesModule {}
