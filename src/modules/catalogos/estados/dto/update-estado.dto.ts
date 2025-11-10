import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateEstadoDto } from './create-estado.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateEstadoDto extends PartialType(CreateEstadoDto) {
  @ApiPropertyOptional({
    example: 2,
    description: 'ID del usuario que actualiza el registro',
  })
  @IsOptional()
  @IsNumber()
  actualizadoPor?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'ID del usuario que elimina (desactiva) el registro',
  })
  @IsOptional()
  @IsNumber()
  eliminadoPor?: number;
}
