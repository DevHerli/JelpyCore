import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateCategoriaDto {
  @ApiProperty({
    example: 'Salud',
    description: 'Nombre de la categoría principal',
  })
  @IsString()
  nombre: string;

  @ApiProperty({
    example: 'Doctores, hospitales y servicios médicos',
    description: 'Descripción breve de la categoría',
    required: false,
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({
    example: true,
    description: 'Define si la categoría está activa o no',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
