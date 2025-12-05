import { IsNumber, IsBoolean } from 'class-validator';

export class AssignCaracteristicaDto {
  @IsNumber()
  caracteristica_id: number;

  @IsBoolean()
  valor: boolean;
}
