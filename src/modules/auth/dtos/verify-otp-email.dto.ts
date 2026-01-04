import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class VerifyOtpEmailDto {
  @IsEmail()
  correoElectronico: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe tener 6 dígitos.' })
  codigo: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  nuevaContrasena: string;
}
