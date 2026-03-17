import { PartialType } from '@nestjs/mapped-types';
import { CreateColoniaDto } from './create-colonia.dto';
import { IsNumberString, IsOptional } from 'class-validator';

export class UpdateColoniaDto extends PartialType(CreateColoniaDto) {
  @IsOptional()
  @IsNumberString()
  actualizado_por?: string;
}