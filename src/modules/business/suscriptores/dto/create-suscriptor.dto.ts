import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Length,
  IsNumber,
} from 'class-validator';

export class CreateSuscriptorDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @IsOptional()
  @IsString()
  apellidoMaterno?: string;

  @IsEnum(['M', 'F', 'Otro'])
  sexo: string;

  @IsString()
  @IsNotEmpty()
  fechaNacimiento: string;

  @IsNumber()
  @IsNotEmpty()
  ciudadId?: number;

  @IsString()
  @Length(10, 20)
  telefonoCelular: string;

  @IsEmail()
  correoElectronico: string;

  @IsString()
  @MinLength(6)
  contrasena: string;

  @IsNumber()
  @IsOptional()
  estadoId?: number;
}
