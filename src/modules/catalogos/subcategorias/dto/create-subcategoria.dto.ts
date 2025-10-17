import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

export class CreateSubcategoriaDto {
  @IsNumber()
  @IsNotEmpty()
  categoria_id: number;

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
