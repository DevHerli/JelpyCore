import {
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    IsBoolean,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  
  export class UpdateEstadoDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    nombre?: string;
  
    @IsOptional()
    @IsString()
    @MaxLength(255)
    descripcion?: string;
  
    @IsOptional()
    @IsEnum(['general', 'suscriptor', 'negocio', 'promocion', 'membresia', 'tickets', 'soporte'])
    tipo?: string;
  

    @IsOptional()
    @Type(() => Boolean) // convierte strings "true"/"false" a booleanos
    @IsBoolean()
    activo?: boolean;
  }
  