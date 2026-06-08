import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsNumber,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class AplicabilidadDto {
  @IsIn(['categoria', 'subcategoria', 'especialidad', 'tipo_servicio', 'todos'])
  nivel: 'categoria' | 'subcategoria' | 'especialidad' | 'tipo_servicio' | 'todos';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  referenciaId?: number | null;
}

export class CreateCaracteristicaDto {
  @IsNotEmpty()
  @IsString()
  codigo: string;

  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  categoriaVisual: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  icono?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AplicabilidadDto)
  aplicabilidades?: AplicabilidadDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}