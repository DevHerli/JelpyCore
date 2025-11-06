import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

export class CreateEstadoDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @IsOptional()
  @IsEnum(['general', 'suscriptor', 'negocio', 'promocion', 'membresia', 'tickets', 'soporte'])
  tipo?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean; 
}
