import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class MarcarEventosLeidosDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  suscriptorId: number;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  eventoIds: number[];
}