import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+52)?[0-9]{10}$/, {
    message: 'Debe ser un número mexicano válido (10 dígitos o con +52)',
  })  
  phoneNumber: string;
}
