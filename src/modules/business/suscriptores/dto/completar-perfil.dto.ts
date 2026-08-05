import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CompletarPerfilDto {
  @IsEnum(['M', 'F', 'Otro', 'No especifica'])
  @IsOptional()
  sexo: string;

  @IsDateString()
  @IsOptional()
  fechaNacimiento: string;

  // 10 dígitos exactos — formato mexicano estándar
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}$/, {
    message: 'telefonoCelular debe tener exactamente 10 dígitos numéricos.',
  })
  telefonoCelular: string;

  // Selección de membresía obligatoria
  @IsNumber()
  @IsNotEmpty()
  membresiaId: number;
}
