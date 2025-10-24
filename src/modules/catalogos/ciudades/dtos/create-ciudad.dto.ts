import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateCiudadDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  estado: string;

  @IsOptional()
  @IsString()
  pais?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
