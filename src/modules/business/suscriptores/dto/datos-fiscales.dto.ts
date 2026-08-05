import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class DatosFiscalesDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @Length(12, 13, { message: 'RFC debe tener 12 o 13 caracteres.' })
  @Matches(/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/i, {
    message: 'RFC inválido: formato incorrecto.',
  })
  rfc?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 150)
  razonSocial?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 10)
  usoCfdi?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 10)
  regimenFiscal?: string;

  // Código postal fiscal mexicano: exactamente 5 dígitos
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, {
    message: 'codigoPostalFiscal debe tener exactamente 5 dígitos.',
  })
  codigoPostalFiscal?: string;

  // Email de facturación validado como dirección de correo real
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsEmail({}, { message: 'emailFiscal debe ser una dirección de correo válida.' })
  emailFiscal?: string;
}
