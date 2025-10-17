import { IsInt, IsNumber, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';

export class CreateVentaMembresiaDto {
  @IsInt()
  suscriptorId: number;

  @IsOptional()
  @IsInt()
  negocioId?: number;

  @IsInt()
  membresiaId: number;

  @IsOptional()
  @IsInt()
  ciudadId?: number;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsOptional()
  @IsEnum(['tarjeta', 'transferencia', 'oxxo', 'cortesia'])
  metodoPago?: string;

  @IsOptional()
  @IsEnum(['pagado', 'pendiente', 'cancelado'])
  estatus?: string;

  @IsOptional()
  @IsDateString()
  fechaExpiracion?: string;
}
