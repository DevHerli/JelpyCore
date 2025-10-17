import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  IsNumber,
} from 'class-validator';

export class CreateEstadisticaHistoricoDto {
  @IsNotEmpty()
  @IsDateString({}, { message: 'fecha debe ser una fecha ISO 8601 válida' })
  fecha: string; // formato: '2025-10-14T00:00:00Z' o '2025-10-14'

  @IsNotEmpty()
  @IsInt()
  negocioId: number;

  @IsNotEmpty()
  @IsInt()
  ciudadId: number;

  @IsOptional()
  @IsInt()
  membresiaId?: number;

  @IsOptional()
  @IsNumber()
  vistas?: number;

  @IsOptional()
  @IsNumber()
  clics?: number;

  @IsOptional()
  @IsNumber()
  busquedas?: number;
}
