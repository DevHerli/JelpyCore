import { PartialType } from '@nestjs/swagger';
import { CreateCategoriaDto } from './create-categoria.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';

export class UpdateCategoriaDto extends PartialType(CreateCategoriaDto) {
  @ApiPropertyOptional({ example: 2, description: 'ID del usuario que actualiza la categoría' })
  @IsOptional()
  @IsNumber()
  actualizadoPor?: number;
}
