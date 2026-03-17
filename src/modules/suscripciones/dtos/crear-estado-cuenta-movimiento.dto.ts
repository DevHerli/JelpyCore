import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CrearEstadoCuentaMovimientoDto {
  @IsInt()
  @IsPositive()
  suscriptorId: number;

  @IsEnum(['cargo', 'abono', 'ajuste', 'reembolso'] as const)
  tipoMovimiento: 'cargo' | 'abono' | 'ajuste' | 'reembolso';

  @IsString()
  @MaxLength(255)
  descripcion: string;

  // Uno de estos debe venir según el tipo:
  // - cargo: cargoCentavos > 0
  // - abono: abonoCentavos > 0
  // - ajuste/reembolso: puede ser cargo o abono según tu criterio (te lo validamos en service)
  @IsOptional()
  @IsInt()
  @Min(0)
  cargoCentavos?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  abonoCentavos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenciaTabla?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  referenciaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  moneda?: string; // default MXN
}