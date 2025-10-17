import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadisticasService } from './estadisticas.service';
import { EstadisticasController } from './estadisticas.controller';
import { Negocio } from '../../../business/negocios/entities/negocio.entity';
import { SucursalNegocio } from '../../../business/sucursales_negocios/entities/sucursal-negocio.entity';
import { PromocionSucursal } from '../../../business/promociones_sucursal/entities/promocion-sucursal.entity';

@Module({
  imports: [
    // Si usas repositorios, los importas aquí (aunque usas DataSource, así TypeORM inicializa las entidades)
    TypeOrmModule.forFeature([Negocio, SucursalNegocio, PromocionSucursal]),
  ],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
  exports: [EstadisticasService], // por si lo usas en otros módulos (por ejemplo dashboard o admin)
})
export class EstadisticasModule {}
