import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsBooleanString, 
  IsNumberString, 
  IsOptional, 
  IsString 
} from 'class-validator';

export class SearchDto {
  @ApiPropertyOptional({
    description: 'Consulta general: ej. "sushi", "cardiología", "tacos al pastor", "pediatra"',
    example: 'pediatra'
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Ciudad donde buscar: ej. "Tepic", "Guadalajara"',
    example: 'Tepic'
  })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiPropertyOptional({
    description: 'true = solo negocios abiertos ahora',
    example: 'true'
  })
  @IsOptional()
  @IsBooleanString()
  abiertoAhora?: string;

  @ApiPropertyOptional({
    description: 'Latitud del usuario (GPS)',
    example: '21.500123'
  })
  @IsOptional()
  @IsNumberString()
  lat?: string;

  @ApiPropertyOptional({
    description: 'Longitud del usuario (GPS)',
    example: '-104.900987'
  })
  @IsOptional()
  @IsNumberString()
  lng?: string;

  @ApiPropertyOptional({
    description: 'Radio de búsqueda en kilómetros (default: 10 km)',
    example: '10'
  })
  @IsOptional()
  @IsNumberString()
  radioKm?: string;

  @ApiPropertyOptional({
    description: 'ID de categoría (si la IA detectó categoría exacta)',
    example: '3'
  })
  @IsOptional()
  @IsNumberString()
  categoriaId?: string;

  @ApiPropertyOptional({
    description: 'ID de subcategoría detectada por IA o filtros',
    example: '12'
  })
  @IsOptional()
  @IsNumberString()
  subcategoriaId?: string;

  @ApiPropertyOptional({
    description: 'ID de especialidad detectada por IA (solo médicos)',
    example: '5'
  })
  @IsOptional()
  @IsNumberString()
  especialidadId?: string;

  @ApiPropertyOptional({
    description: 'true = solo negocios con promociones activas',
    example: 'true'
  })
  @IsOptional()
  @IsBooleanString()
  promos?: string;
}
