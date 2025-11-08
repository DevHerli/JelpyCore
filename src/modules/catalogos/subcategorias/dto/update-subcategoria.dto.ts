import { PartialType } from '@nestjs/swagger';
import { CreateSubcategoriaDto } from './create-subcategoria.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';

export class UpdateSubcategoriaDto extends PartialType(CreateSubcategoriaDto) {
  @ApiPropertyOptional({ example: 2, description: 'ID del usuario que actualiza la subcategoría' })
  @IsOptional()
  @IsNumber()
  actualizadoPor?: number;
}
