import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'El número de teléfono es obligatorio' })
  @Matches(/^[0-9]{10}$/, {
    message: 'Debe ser un número celular válido de 10 dígitos',
  })
  phoneNumber: string;
}
