import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturasController } from './facturas.controller';
import { FacturasService } from './facturas.service';
import { Factura } from './entities/factura.entity';
import { PerfilFacturacion } from './entities/perfil-facturacion.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Pago } from '../pagos/entities/pago.entity';

@Module({
  imports: [
    // PerfilFacturacion es obligatorio: facturas.perfil_facturacion_id es
    // NOT NULL con FK, así que no se puede insertar una factura sin él.
    TypeOrmModule.forFeature([Factura, PerfilFacturacion, Suscriptor, Pago]),
  ],
  controllers: [FacturasController],
  providers: [FacturasService],
  exports: [FacturasService],
})
export class FacturasModule {}
