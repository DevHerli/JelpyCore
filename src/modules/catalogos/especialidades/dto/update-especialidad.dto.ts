import { IsNumber, IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

export class UpdateEspecialidadDto {
  @IsNumber()
  @IsOptional()
  subcategoria_id?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
