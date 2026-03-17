import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreatePostalCodeDto {
  @IsNotEmpty()
  @IsNumberString()
  ciudad_id: string;

  @IsNotEmpty()
  @IsString()
  @Length(5, 10)
  codigo_postal: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tipo_asentamiento_principal?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumberString()
  creado_por?: string;
}