import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SucursalNegocio } from './entities/sucursal-negocio.entity';
import { SucursalImagen } from './entities/sucursal-imagen.entity';
import { SucursalesNegociosService } from './sucursales-negocios.service';
import { SucursalesNegociosController } from './sucursales-negocios.controller';

import { CaracteristicasSucursalModule } from '../caracteristicas_sucursales/caracteristicas-sucursal.module';
import { EstadisticasModule } from '../../core/metrics/estadisticas/estadisticas.module';

import { Street } from '../domicilios/calles/entities/street.entity';
import { Colonia } from '../domicilios/colonias/entities/colonia.entity';
import { PostalCode } from '../domicilios/codigos_postal/entities/postal-code.entity';
import { Negocio } from '../negocios/entities/negocio.entity';
import { MembresiaCuotas } from '../../suscripciones/entities/membresia-cuotas.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SucursalNegocio,
      SucursalImagen,
      Street,
      Colonia,
      PostalCode,
      Negocio,
      // JLP-QUOTA — límite de sucursales por negocio (max_sucursales), leído
      // directo aquí porque es un chequeo per-negocio, no per-suscriptor: no
      // pasa por SuscripcionesService/consumirCuota (ver comentario en la entity).
      MembresiaCuotas,
    ]),
    CaracteristicasSucursalModule,
    EstadisticasModule,
  ],
  controllers: [SucursalesNegociosController],
  providers: [SucursalesNegociosService],
  exports: [SucursalesNegociosService],
})
export class SucursalesNegociosModule {}