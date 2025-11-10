import {
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    Max,
  } from 'class-validator';
  import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
  
  export class CreateKeywordDto {
    @ApiProperty({
      enum: ['categoria', 'subcategoria', 'especialidad'],
      example: 'categoria',
    })
    @IsEnum(['categoria', 'subcategoria', 'especialidad'])
    tipo: 'categoria' | 'subcategoria' | 'especialidad';
  
    @ApiProperty({ example: 1 })
    @IsNumber()
    referenciaId: number;
  
    @ApiProperty({ example: 'farmacia' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    keyword: string;
  
    @ApiPropertyOptional({ example: 3 })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(10)
    relevancia?: number;
  
    @ApiPropertyOptional({ example: 'es' })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    idioma?: string;
  }
  