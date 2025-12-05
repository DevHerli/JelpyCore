import { IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean, IsIn, ValidateIf } from 'class-validator';

export class CreateHorarioSucursalDto {
  @IsNotEmpty()
  sucursalId: number;

  @IsIn(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])
  diaSemana: string;

  @ValidateIf(o => !o.cerrado)
  @IsNotEmpty()
  horaApertura: string;

  @ValidateIf(o => !o.cerrado)
  @IsNotEmpty()
  horaCierre: string;

  @IsOptional()
  @IsBoolean()
  cerrado?: boolean;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
