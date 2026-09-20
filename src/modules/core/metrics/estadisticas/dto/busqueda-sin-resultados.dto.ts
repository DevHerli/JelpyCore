import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class BusquedaSinResultadosDto {
  @IsString()
  @MaxLength(255)
  termino!: string;

  @IsString()
  @MaxLength(40)
  origen!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  superficie?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ciudadId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ciudadNombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoriaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  categoriaNombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  subcategoriaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subcategoriaNombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  especialidadId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  especialidadNombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  negocioId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  sucursalId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  resultados?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
