import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10}$/, {
    message: 'El número de teléfono debe tener 10 dígitos',
  })
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{4,6}$/, {
    message: 'Solo se permiten códigos numéricos de 4 a 6 dígitos',
  })
  code: string;
}
