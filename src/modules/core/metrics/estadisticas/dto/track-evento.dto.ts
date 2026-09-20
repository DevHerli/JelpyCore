import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TIPOS_EVENTO_ESTADISTICA, TipoEventoEstadistica } from '../estadisticas.service';

// JLP-SEC / METRICS-001: POST /estadisticas/evento no tenía DTO — aceptaba
// cualquier string en `tipo`/`entidad` en runtime (el tipado de TS solo
// protege en compile-time, no contra un curl directo). Con ValidationPipe
// global ({ whitelist: true, transform: true } en main.ts), este DTO
// rechaza valores fuera de whitelist con 400 en vez de dejarlos pasar a
// registrarEvento (que además ya valida por su cuenta como defensa extra).
export class TrackEventoDto {
  @IsIn(['negocio', 'sucursal'])
  entidad!: 'negocio' | 'sucursal';

  @IsInt()
  @IsPositive()
  id!: number;

  @IsIn(TIPOS_EVENTO_ESTADISTICA)
  tipo!: TipoEventoEstadistica;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  origen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  superficie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  termino?: string;

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
