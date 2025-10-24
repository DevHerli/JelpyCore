// src/categorias/dto/update-categoria.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCategoriaDto } from './create-categoria.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateCategoriaDto extends PartialType(CreateCategoriaDto) {
  @ApiPropertyOptional({
    example: 'Salud y Bienestar',
    description: 'Nombre de la categoría (opcional en update)',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    example: 'Servicios médicos, clínicas y hospitales',
    description: 'Descripción de la categoría (opcional)',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Estatus de actividad (opcional)',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
