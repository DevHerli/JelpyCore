import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsBoolean,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePromocionSucursalDto {
  @IsNotEmpty()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  sucursalId: number;

  // Alcance opcional — si se omiten ambos, la promo se crea sólo para
  // `sucursalId` (comportamiento histórico, una sucursal).
  //
  // `aplicarATodas: true`  → se replica en TODAS las sucursales activas del
  //   negocio dueño de `sucursalId`.
  // `sucursalIds: [...]`   → se replica en `sucursalId` + las sucursales
  //   indicadas (deben pertenecer al mismo negocio).
  //
  // En cualquiera de los dos casos, si el resultado son 2+ sucursales, el
  // servicio agrupa las filas creadas con un `loteGlobalId` común y marca
  // `origen: 'BUSINESS'`.
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  @IsBoolean()
  aplicarATodas?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;

    const arr = Array.isArray(value) ? value : String(value).split(',');

    return arr
      .map((item) => Number(String(item).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  })
  @IsNumber({}, { each: true })
  sucursalIds?: number[];

  @IsNotEmpty()
  @IsString()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsEnum(['Descuento', '2x1', 'Regalo', 'Cortesía', 'Otro'])
  tipoPromocion: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Number(value);
  })
  @IsNumber()
  valorDescuento?: number;

  @IsNotEmpty()
  @IsDateString()
  fechaInicio: string;

  @IsNotEmpty()
  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;

    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  })
  @IsString({ each: true })
  diasVigencia?: string[];

  @IsOptional()
  @IsString()
  horaInicio?: string;

  @IsOptional()
  @IsString()
  horaFin?: string;

  @IsOptional()
  @IsString()
  condiciones?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  @IsBoolean()
  activa?: boolean;
}