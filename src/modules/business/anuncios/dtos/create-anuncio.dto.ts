import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

const PLACEMENTS = ['home_slider', 'home_feed', 'home_footer', 'home_bottom'] as const;

export class CreateAnuncioDto {
  @IsNumber()
  negocioId: number;

  @IsOptional()
  @IsNumber()
  sucursalId?: number;

  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  // --- Publicidad v2 ---
  @IsOptional()
  @IsIn(PLACEMENTS)
  placement?: string;

  @IsOptional()
  @IsNumber()
  ciudadId?: number;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  externalUrl?: string;
}
