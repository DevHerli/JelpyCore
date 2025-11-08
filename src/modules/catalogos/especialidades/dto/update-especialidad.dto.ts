import { PartialType } from '@nestjs/swagger';
import { CreateEspecialidadDto } from './create-especialidad.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';

export class UpdateEspecialidadDto extends PartialType(CreateEspecialidadDto) {
  @ApiPropertyOptional({ example: 2, description: 'ID del usuario que actualiza la especialidad' })
  @IsOptional()
  @IsNumber()
  actualizadoPor?: number;
}
