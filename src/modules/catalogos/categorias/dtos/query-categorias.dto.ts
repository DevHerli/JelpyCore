import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

function toBoolean(value: any): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const v = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;
  return undefined;
}

export class QueryCategoriasDto {
  /**
   * Búsqueda por texto (nombre/descripcion)
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /**
   * Filtrar por activo true/false
   */
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  activo?: boolean;

  /**
   * Rango de fechas por fechaCreacion (YYYY-MM-DD o ISO)
   */
  @IsOptional()
  @IsString()
  fecha_desde?: string;

  @IsOptional()
  @IsString()
  fecha_hasta?: string;

  /**
   * Incluir subcategorías en la respuesta
   */
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  includeSubcategorias?: boolean;

  /**
   * Ordenamiento
   */
  @IsOptional()
  @IsIn(['id', 'nombre', 'fechaCreacion'])
  orderBy?: 'id' | 'nombre' | 'fechaCreacion';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  orderDir?: 'ASC' | 'DESC' | 'asc' | 'desc';

  /**
   * Paginación (opcional pero recomendable)
   */
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  limit?: number;
}
