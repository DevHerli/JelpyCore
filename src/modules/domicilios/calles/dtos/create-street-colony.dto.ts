import {
  IsBoolean,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
} from 'class-validator';

export class CreateStreetColonyDto {
  @IsNotEmpty()
  @IsNumberString()
  calle_id: string;

  @IsNotEmpty()
  @IsNumberString()
  colonia_id: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumberString()
  creado_por?: string;
}