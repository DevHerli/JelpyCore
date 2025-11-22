import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginEmailDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  correoElectronico: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  contrasena: string;
}
