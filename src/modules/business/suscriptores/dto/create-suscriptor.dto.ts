import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsNumber,
  IsBoolean,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSuscriptorDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  apellidoPaterno: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  apellidoMaterno?: string;

  @IsEnum(['M', 'F', 'Otro', 'No especifica'])
  @IsOptional()
  sexo?: string;

  @IsOptional()
  @IsString()
  fechaNacimiento?: string;

  @IsNumber()
  @IsNotEmpty()
  ciudadId: number;

  // 10 dígitos exactos — formato mexicano estándar
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'telefonoCelular debe tener exactamente 10 dígitos numéricos.',
  })
  telefonoCelular?: string;

  // Registro OBLIGATORIAMENTE por correo
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'correoElectronico debe ser un correo válido.' })
  @IsNotEmpty()
  correoElectronico: string;

  // Contraseña mínima 8 caracteres (OWASP mínimo recomendado)
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @IsNotEmpty()
  contrasena: string;

  @IsOptional()
  @IsNumber()
  estadoId?: number;

  @IsBoolean()
  @IsNotEmpty()
  aceptoTerminos: boolean;
}
