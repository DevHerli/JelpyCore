import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class CheckOtpEmailDto {
  @IsEmail()
  @IsNotEmpty()
  correoElectronico: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  codigo: string;
}
