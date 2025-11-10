import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEstadoDto {
  @ApiProperty({ example: 'Activo' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({ example: 'Estado general activo' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiPropertyOptional({
    enum: [
      'general',
      'suscriptor',
      'negocio',
      'promocion',
      'membresia',
      'promociones',
      'anuncios',
      'sucursales',
    ],
    example: 'general',
  })
  @IsOptional()
  @IsEnum([
    'general',
    'suscriptor',
    'negocio',
    'promocion',
    'membresia',
    'promociones',
    'anuncios',
    'sucursales',
  ])
  tipo?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  creadoPor?: number;
}
