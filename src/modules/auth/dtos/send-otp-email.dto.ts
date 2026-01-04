import { IsEmail } from 'class-validator';

export class SendOtpEmailDto {
  @IsEmail()
  correoElectronico: string;
}
