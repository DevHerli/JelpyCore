import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateNegocioDto {
  @IsNotEmpty()
  @IsNumber()
  suscriptorId: number;

  @IsNotEmpty()
  @IsString()
  nombreNegocio: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string; 

  @IsNotEmpty()
  @IsNumber()
  ciudadId: number;

  @IsNotEmpty()
  @IsNumber()
  categoriaId: number;

  @IsOptional()
  @IsNumber()
  subcategoriaId?: number;

  @IsOptional()
  @IsNumber()
  especialidadId?: number;

  @IsOptional()
  @IsNumber()
  estadoId?: number;
}
