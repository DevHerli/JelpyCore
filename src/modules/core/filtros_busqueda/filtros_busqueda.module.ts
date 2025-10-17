import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiltrosBusquedaService } from './filtros_busqueda.service';
import { FiltrosBusquedaController } from './filtros_busqueda.controller';
import { Negocio } from '../../business/negocios/entities/negocio.entity';
import { PromocionSucursal } from '../../business/promociones_sucursal/entities/promocion-sucursal.entity';
import { HorarioSucursal } from '../../business/horario_sucursal/entities/horarios-sucursal.entity';
import { SucursalNegocio } from '../../business/sucursales_negocios/entities/sucursal-negocio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Negocio, PromocionSucursal, HorarioSucursal, SucursalNegocio])],
  controllers: [FiltrosBusquedaController],
  providers: [FiltrosBusquedaService],
  exports: [FiltrosBusquedaService],
})
export class FiltrosBusquedaModule {}
