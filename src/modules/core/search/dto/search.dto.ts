import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class SearchDto {
  @ApiPropertyOptional({ description: 'Consulta: ej. "sushi", "cardiología", "tacos al pastor"' })
  @IsString() q?: string;

  @ApiPropertyOptional({ description: 'Ciudad: ej. Tepic' })
  @IsOptional() @IsString() ciudad?: string;

  @ApiPropertyOptional({ description: 'true=solo abiertos ahora' })
  @IsOptional() @IsBooleanString() abiertoAhora?: string;

  @ApiPropertyOptional({ description: 'Latitud usuario' })
  @IsOptional() @IsNumberString() lat?: string;

  @ApiPropertyOptional({ description: 'Longitud usuario' })
  @IsOptional() @IsNumberString() lng?: string;

  @ApiPropertyOptional({ description: 'Radio km (default 10)' })
  @IsOptional() @IsNumberString() radioKm?: string;
}
