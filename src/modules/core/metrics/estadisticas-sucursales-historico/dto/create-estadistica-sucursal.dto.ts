import { IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateEstadisticaSucursalDto {
  @IsInt()
  sucursalId: number;

  @IsInt()
  negocioId: number;

  @IsOptional()
  @IsInt()
  ciudadId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  vistas?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  clics?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  busquedas?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}
