import { IsNotEmpty, IsOptional, IsEnum, IsString, IsBoolean, IsDateString, IsArray } from 'class-validator';

export class CreatePromocionSucursalDto {
  @IsNotEmpty()
  sucursalId: number;

  @IsNotEmpty()
  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(['Descuento', '2x1', 'Regalo', 'Cortesía', 'Otro'])
  tipoPromocion: string;

  @IsOptional()
  valorDescuento?: number;

  @IsNotEmpty()
  @IsDateString()
  fechaInicio: string;

  @IsNotEmpty()
  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diasVigencia?: string[];

  @IsOptional()
  horaInicio?: string;

  @IsOptional()
  horaFin?: string;

  @IsOptional()
  condiciones?: string;

  @IsOptional()
  imagenUrl?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
