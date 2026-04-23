import { PartialType } from '@nestjs/mapped-types';
import { CreateStreetColonyDto } from './create-street-colony.dto';
import { IsNumberString, IsOptional } from 'class-validator';

export class UpdateStreetColonyDto extends PartialType(CreateStreetColonyDto) {
  @IsOptional()
  @IsNumberString()
  actualizado_por?: string;
}