import { IsNotEmpty, IsNumber, IsString, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class CreateEspecialidadDto {
  @IsNumber()
  @IsNotEmpty()
  subcategoria_id: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  descripcion?: string;

  @IsBoolean()
  @IsOptional()
  activo?: boolean;
}
