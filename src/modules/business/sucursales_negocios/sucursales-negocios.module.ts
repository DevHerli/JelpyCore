import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SucursalNegocio } from './entities/sucursal-negocio.entity';
import { SucursalesNegociosService } from './sucursales-negocios.service';
import { SucursalesNegociosController } from './sucursales-negocios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SucursalNegocio])],
  controllers: [SucursalesNegociosController],
  providers: [SucursalesNegociosService],
  exports: [SucursalesNegociosService],
})
export class SucursalesNegociosModule {}
