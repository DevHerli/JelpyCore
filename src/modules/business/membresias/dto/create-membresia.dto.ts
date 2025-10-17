import { IsNotEmpty, IsOptional, IsString, IsNumber, IsInt, Min, MaxLength } from 'class-validator';

export class CreateMembresiaDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNumber()
  @Min(0)
  precio: number;

  @IsInt()
  @Min(1)
  duracion_meses: number;

  @IsOptional()
  @IsString()
  beneficios?: string;
}
