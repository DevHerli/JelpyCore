import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';

export class CambiarPlanDto {
  @IsInt()
  @IsPositive()
  suscriptorId: number;

  @IsInt()
  @IsPositive()
  nuevaMembresiaId: number;

  @IsDateString()
  fechaInicio: string;

  @IsOptional()
  @IsDateString()
  proximaFechaCorte?: string;

  @IsOptional()
  renovacionAutomatica?: boolean;

  @IsOptional()
  motivo?: string;
}