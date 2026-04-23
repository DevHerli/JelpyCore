import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';

export class AssignCaracteristicaDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  caracteristica_id: number;

  @IsNotEmpty()
  @Type(() => Boolean)
  @IsBoolean()
  valor: boolean;
}