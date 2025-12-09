// dtos/create-publicidad-chat.dto.ts
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePublicidadChatDto {
  @IsOptional()
  @IsInt()
  negocioId?: number;

  @IsOptional()
  @IsInt()
  sucursalId?: number;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsInt()
  categoriaId?: number;

  @IsOptional()
  @IsInt()
  subcategoriaId?: number;

  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsString()
  @IsNotEmpty()
  textoPublicitario: string;

  @IsOptional()
  @IsString()
  palabrasClave?: string;

  @IsOptional()
  @IsString()
  urlDestino?: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  prioridad?: number;
}
