import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsBooleanString, 
  IsNumberString, 
  IsOptional, 
  IsString 
} from 'class-validator';

export class SearchDto {
  // 🔍 Campo principal de búsqueda
  @ApiPropertyOptional({
    description: 'Consulta general: ej. "sushi", "cardiología", "tacos", "pediatra"',
    example: 'pediatra'
  })
  @IsOptional()
  @IsString()
  q?: string;

  // 🔍 Campo secundario compatible con IA (misma función que q)
  @ApiPropertyOptional({
    description: 'Alias de búsqueda usado por la IA. Se combina con q.',
    example: 'pediatra'
  })
  @IsOptional()
  @IsString()
  termino?: string;

  // 📍 Ciudad
  @ApiPropertyOptional({
    description: 'Ciudad donde buscar: ej. "Tepic", "Guadalajara"',
    example: 'Tepic'
  })
  @IsOptional()
  @IsString()
  ciudad?: string;

  // 🟢 Abierto ahora
  @ApiPropertyOptional({
    description: 'true = solo negocios abiertos ahora',
    example: 'true'
  })
  @IsOptional()
  @IsBooleanString()
  abiertoAhora?: string;

  // 📌 Ubicación GPS
  @ApiPropertyOptional({ description: 'Latitud del usuario', example: '21.500123' })
  @IsOptional()
  @IsNumberString()
  lat?: string;

  @ApiPropertyOptional({ description: 'Longitud del usuario', example: '-104.900987' })
  @IsOptional()
  @IsNumberString()
  lng?: string;

  @ApiPropertyOptional({
    description: 'Radio de búsqueda en KM (default: 10 km)',
    example: '10'
  })
  @IsOptional()
  @IsNumberString()
  radioKm?: string;

  // 🗂 Taxonomía
  @ApiPropertyOptional({
    description: 'ID de categoría detectada por la IA',
    example: '3'
  })
  @IsOptional()
  @IsNumberString()
  categoriaId?: string;

  @ApiPropertyOptional({
    description: 'ID de subcategoría detectada',
    example: '12'
  })
  @IsOptional()
  @IsNumberString()
  subcategoriaId?: string;

  @ApiPropertyOptional({
    description: 'ID de especialidad detectada (solo médicos)',
    example: '5'
  })
  @IsOptional()
  @IsNumberString()
  especialidadId?: string;

  // 🎉 Filtro de promociones
  @ApiPropertyOptional({
    description: 'true = solo negocios con promociones activas',
    example: 'true'
  })
  @IsOptional()
  @IsBooleanString()
  promos?: string;
}
