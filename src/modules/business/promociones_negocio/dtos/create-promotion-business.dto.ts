import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export type TipoPromocion =
  | 'Descuento'
  | '2x1'
  | 'Promo'
  | 'Gratis'
  | 'Regalo'
  | 'Cortesía'
  | 'Otro';

const TIPOS: TipoPromocion[] = [
  'Descuento',
  '2x1',
  'Promo',
  'Gratis',
  'Regalo',
  'Cortesía',
  'Otro',
];

export class CreatePromotionBusinessDto {
  @IsInt()
  @IsPositive()
  negocioId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsIn(TIPOS)
  tipoPromocion: TipoPromocion;

  @IsOptional()
  @ValidateIf((o) => o.tipoPromocion === 'Descuento')
  // si no es descuento, lo ignoras
  valorDescuento?: number;

  @IsDateString()
  fechaInicio: string; // YYYY-MM-DD

  @IsDateString()
  fechaFin: string; // YYYY-MM-DD

  @IsOptional()
  @IsArray()
  diasVigencia?: string[]; // ['Lunes', ...]

  @IsOptional()
  @IsString()
  horaInicio?: string; // HH:mm:ss

  @IsOptional()
  @IsString()
  horaFin?: string;

  @IsOptional()
  @IsString()
  condiciones?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  /**
   * Si true -> se vincula a todas las sucursales del negocio.
   * Si false -> debes mandar sucursalIds.
   */
  @IsBoolean()
  aplicaTodasSucursales: boolean;

  @IsOptional()
  @IsArray()
  sucursalIds?: number[];

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}