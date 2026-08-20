import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class SolicitarFacturaDto {
  @IsNumber()
  @Min(1)
  suscriptorId: number;

  /** Pago que se factura. Si se envía, el importe se toma de él. */
  @IsOptional()
  @IsNumber()
  @Min(1)
  pagoId?: number;

  /**
   * Importe TOTAL a facturar, en centavos y con IVA incluido.
   * El subtotal y los impuestos se derivan de aquí (ver desglosarIva).
   * Obligatorio si no se manda `pagoId`.
   */
  @IsOptional()
  @IsInt({ message: 'totalCentavos debe ser un entero de centavos (ej. 19900 = $199.00).' })
  @Min(1)
  totalCentavos?: number;

  // NOTA — se eliminó `concepto`.
  // La entity anterior declaraba una columna `concepto` que la tabla `facturas`
  // no tiene, así que ese texto nunca se guardó ni se pudo guardar. Mantenerlo
  // en el DTO daba a entender que se conservaba cuando en realidad se perdía.
  // En un CFDI los conceptos son renglones con clave de producto/servicio,
  // unidad y valor unitario del catálogo del SAT: viven en su propia tabla
  // (`factura_conceptos`), que aún no existe. Cuando se integre el PAC hay que
  // crearla; poner un varchar libre no serviría para timbrar.
}
