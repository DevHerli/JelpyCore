import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber, MaxLength } from 'class-validator';

export class CreateEspecialidadDto {
  @ApiProperty({ example: 1, description: 'ID de la subcategoría a la que pertenece' })
  @IsNotEmpty()
  @IsNumber()
  subcategoria_id: number;

  @ApiProperty({ example: 'Cardiología', description: 'Nombre de la especialidad' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Especialidad del corazón y sistema circulatorio', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ example: 1, required: false, description: 'ID del usuario que crea la especialidad' })
  @IsOptional()
  @IsNumber()
  creadoPor?: number;
}
