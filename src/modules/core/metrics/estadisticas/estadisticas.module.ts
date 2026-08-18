import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardsModule } from '../../../../common/guards/guards.module';
import { EstadisticasService } from './estadisticas.service';
import { EstadisticasController } from './estadisticas.controller';
import { Negocio } from '../../../business/negocios/entities/negocio.entity';
import { SucursalNegocio } from '../../../business/sucursales_negocios/entities/sucursal-negocio.entity';
import { PromocionSucursal } from '../../../business/promociones_sucursal/entities/promocion-sucursal.entity';

@Module({
  imports: [
    // GuardsModule: provee AdminGuard (con SuscriptorRepository) y JwtAuthGuard
    // usados en este controlador. Aunque GuardsModule es @Global(), importarlo
    // explícitamente garantiza la resolución de dependencias sin importar el
    // orden de inicialización en AppModule.
    GuardsModule,
    TypeOrmModule.forFeature([Negocio, SucursalNegocio, PromocionSucursal]),
  ],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
  exports: [EstadisticasService],
})
export class EstadisticasModule {}
