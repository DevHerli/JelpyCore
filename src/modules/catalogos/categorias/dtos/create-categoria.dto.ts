import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class CreateCategoriaDto {
  @ApiProperty({ example: 'Restaurantes', description: 'Nombre de la categoría' })
  @IsString()
  @MaxLength(100)
  nombre: string;

  @ApiProperty({ example: 'Categoría relacionada con alimentos y bebidas', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiProperty({ example: 1, required: false, description: 'ID del usuario que crea la categoría' })
  @IsOptional()
  creadoPor?: number;
}
