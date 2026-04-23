import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromocionSucursal } from './entities/promocion-sucursal.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { PromocionesSucursalesService } from './promociones-sucursales.service';
import { PromocionesSucursalesController } from './promociones-sucursales.controller';
import { EventosNegociosModule } from '../eventos_negocios/eventos-negocios.module';

@Module({
  imports: [TypeOrmModule.forFeature([PromocionSucursal, SucursalNegocio]),
  EventosNegociosModule],
  controllers: [PromocionesSucursalesController],
  providers: [PromocionesSucursalesService],
})
export class PromocionesSucursalesModule {}
