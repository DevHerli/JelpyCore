import {
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
    MinLength,
    IsDateString,
  } from 'class-validator';
  
  export class CompletarPerfilDto {
    @IsEnum(['M', 'F', 'Otro', 'No especifica'])
    @IsOptional()
    sexo?: string;
  
    @IsDateString()
    @IsOptional()
    fechaNacimiento?: string;
  
    @IsEmail()
    @IsOptional()
    correoElectronico?: string;
  
    @IsString()
    @IsOptional()
    @MinLength(6)
    contrasena?: string;
  }
  