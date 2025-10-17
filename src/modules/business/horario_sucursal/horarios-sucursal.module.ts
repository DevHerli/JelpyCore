import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HorarioSucursal } from './entities/horarios-sucursal.entity';
import { HorariosSucursalService } from './horarios-sucursal.service';
import { HorariosSucursalController } from './horarios-sucursal.controller';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HorarioSucursal, SucursalNegocio])],
  controllers: [HorariosSucursalController],
  providers: [HorariosSucursalService],
})
export class HorariosSucursalModule {}
