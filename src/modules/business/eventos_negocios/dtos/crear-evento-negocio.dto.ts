import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    Min,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  
  export class CrearEventoNegocioDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    negocioId: number;
  
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    sucursalId?: number;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(60)
    tipoEvento: string;
  
    @IsString()
    @IsNotEmpty()
    @MaxLength(180)
    titulo: string;
  
    @IsOptional()
    @IsString()
    descripcion?: string;
  
    @IsOptional()
    @IsObject()
    payload?: Record<string, any>;
  
    @IsOptional()
    @IsBoolean()
    visibleParaFavoritos?: boolean;
  
    @IsOptional()
    @IsBoolean()
    activo?: boolean;
  }