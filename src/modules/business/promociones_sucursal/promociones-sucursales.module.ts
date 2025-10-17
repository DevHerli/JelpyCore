import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromocionSucursal } from './entities/promocion-sucursal.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { PromocionesSucursalesService } from './promociones-sucursales.service';
import { PromocionesSucursalesController } from './promociones-sucursales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PromocionSucursal, SucursalNegocio])],
  controllers: [PromocionesSucursalesController],
  providers: [PromocionesSucursalesService],
})
export class PromocionesSucursalesModule {}
