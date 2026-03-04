import { IsOptional, IsString, MaxLength, MinLength, IsISO8601 } from 'class-validator';

export class UpdateAnuncioDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  descripcion?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string | null;

  @IsOptional()
  @IsString()
  imagenPublicId?: string | null;

  @IsOptional()
  @IsISO8601()
  fechaInicio?: string;

  @IsOptional()
  @IsISO8601()
  fechaFin?: string;
}
