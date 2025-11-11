import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Length,
  IsNumber,
  IsBoolean,
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

  @IsEnum(['M', 'F', 'Otro', 'No especifica'])
  @IsOptional()
  sexo?: string;

  @IsOptional()
  @IsString()
  fechaNacimiento?: string;

  @IsNumber()
  @IsNotEmpty()
  ciudadId: number;

  @IsString()
  @Length(10, 20)
  telefonoCelular: string;

  @IsOptional()
  @IsEmail()
  correoElectronico?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  contrasena?: string;

  @IsNumber()
  @IsOptional()
  estadoId?: number;

  @IsBoolean()
  @IsNotEmpty()
  aceptoTerminos: boolean;
}
