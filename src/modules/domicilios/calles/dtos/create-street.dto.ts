import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateStreetDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(180)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  nombre_normalizado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tipo_vialidad?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumberString()
  creado_por?: string;
}