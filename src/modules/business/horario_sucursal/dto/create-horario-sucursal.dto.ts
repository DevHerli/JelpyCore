import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateHorarioSucursalDto {
  @IsNotEmpty()
  sucursalId: number;

  @IsEnum(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  diaSemana: string;

  @IsNotEmpty()
  horaApertura: string;

  @IsNotEmpty()
  horaCierre: string;

  @IsOptional()
  @IsBoolean()
  cerrado?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
