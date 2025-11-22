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

  //Ahora es opcional (registro ya NO es por teléfono)
  @IsOptional()
  @IsString()
  @Length(10, 20)
  telefonoCelular?: string;

  //Registro ahora es OBLIGATORIAMENTE por correo
  @IsEmail()
  @IsNotEmpty()
  correoElectronico: string;

  //Contraseña requerida para crear la cuenta
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  contrasena: string;

  @IsOptional()
  @IsNumber()
  estadoId?: number;

  @IsBoolean()
  @IsNotEmpty()
  aceptoTerminos: boolean;
}
