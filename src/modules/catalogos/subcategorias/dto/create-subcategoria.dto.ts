import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber, MaxLength } from 'class-validator';

export class CreateSubcategoriaDto {
  @ApiProperty({ example: 1, description: 'ID de la categoría a la que pertenece' })
  @IsNotEmpty()
  @IsNumber()
  categoria_id: number;

  @ApiProperty({ example: 'Pizzerías', description: 'Nombre de la subcategoría' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Restaurantes especializados en pizza', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ example: 1, required: false, description: 'ID del usuario que crea la subcategoría' })
  @IsOptional()
  @IsNumber()
  creadoPor?: number;
}
