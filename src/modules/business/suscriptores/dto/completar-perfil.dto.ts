import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  IsNotEmpty,
  Length,
} from 'class-validator';

export class CompletarPerfilDto {
  @IsEnum(['M', 'F', 'Otro', 'No especifica'])
  @IsOptional()
  sexo: string;

  @IsDateString()
  @IsOptional()
  fechaNacimiento: string;

  //Ahora obligatorio en completar perfil
  @IsString()
  @IsNotEmpty()
  @Length(10, 20)
  telefonoCelular: string;

  //Selección de membresía obligatoria
  @IsNumber()
  @IsNotEmpty()
  membresiaId: number;
}
