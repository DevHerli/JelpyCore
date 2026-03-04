import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, IsNumber } from 'class-validator';

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
  fechaInicio: string; // ISO

  @IsDateString()
  fechaFin: string; // ISO

  @IsOptional()
@IsString()
imagenUrl?: string;

}
