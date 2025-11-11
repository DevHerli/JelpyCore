import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class VerifyOtpRegisterDto {
  @IsString()
  @Matches(/^[0-9]{10}$/, {
    message: 'El número de teléfono debe tener 10 dígitos',
  })
  telefonoCelular: string;

  @IsString()
  @Matches(/^[0-9]{4,6}$/, {
    message: 'Solo se permiten códigos numéricos de 4 a 6 dígitos',
  })
  codigo: string;
}
