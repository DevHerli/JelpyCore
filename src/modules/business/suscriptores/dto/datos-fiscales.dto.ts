import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class DatosFiscalesDto {
  @IsOptional()
  @IsString()
  @Length(12, 13)
  @Matches(/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i, {
    message: 'RFC inválido',
  })
  rfc?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  usoCfdi?: string;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  regimenFiscal?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  codigoPostalFiscal?: string;

  @IsOptional()
  @IsString()
  @Length(1, 150)
  emailFiscal?: string;
}
