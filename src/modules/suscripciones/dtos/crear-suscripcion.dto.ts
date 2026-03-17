import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CrearSuscripcionDto {
  @IsInt()
  @IsPositive()
  suscriptorId: number;

  @IsInt()
  @IsPositive()
  membresiaId: number;

  @IsDateString()
  fechaInicio: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsDateString()
  proximaFechaCorte?: string;

  @IsOptional()
  renovacionAutomatica?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  proveedorPago?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  proveedorSuscripcionId?: string;

  @IsOptional()
  @IsEnum(['activa', 'en_mora', 'cancelada', 'expirada', 'prueba'] as const)
  estatus?: 'activa' | 'en_mora' | 'cancelada' | 'expirada' | 'prueba';
}