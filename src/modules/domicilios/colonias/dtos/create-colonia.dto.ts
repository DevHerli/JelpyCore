import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateColoniaDto {
  @IsNotEmpty()
  @IsNumberString()
  codigo_postal_id: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre_normalizado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipo_asentamiento?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumberString()
  creado_por?: string;
}