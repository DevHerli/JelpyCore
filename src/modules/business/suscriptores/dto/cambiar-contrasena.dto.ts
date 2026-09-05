import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO de entrada para PUT /suscriptores/me/password.
 *
 * La validación de complejidad de `contrasenaNueva` (8+ caracteres, mayúscula,
 * número, carácter especial) NO se hace aquí con @Matches: se hace en
 * SuscriptoresService.cambiarContrasena() para poder devolver el mensaje
 * exacto que espera el front ("La contraseña no cumple los requisitos de
 * seguridad") en vez del array de mensajes que arma class-validator cuando
 * fallan varios decoradores a la vez.
 */
export class CambiarContrasenaDto {
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria.' })
  contrasenaActual: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria.' })
  contrasenaNueva: string;
}
