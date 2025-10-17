import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class FiltrosBusquedaDto {
  @IsOptional()
  @IsString()
  termino?: string;

  @IsOptional()
  @IsNumber()
  ciudadId?: number;

  @IsOptional()
  @IsNumber()
  categoriaId?: number;

  @IsOptional()
  @IsNumber()
  subcategoriaId?: number;

  @IsOptional()
  @IsBoolean()
  abiertoAhora?: boolean;

  @IsOptional()
  @IsBoolean()
  promocionesActivas?: boolean;

  @IsOptional()
  @IsNumber()
  latitud?: number; // coordenada del usuario

  @IsOptional()
  @IsNumber()
  longitud?: number; // coordenada del usuario
}
