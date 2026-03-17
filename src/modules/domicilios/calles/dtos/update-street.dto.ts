import { PartialType } from '@nestjs/mapped-types';
import { CreateStreetDto } from './create-street.dto';
import { IsNumberString, IsOptional } from 'class-validator';

export class UpdateStreetDto extends PartialType(CreateStreetDto) {
  @IsOptional()
  @IsNumberString()
  actualizado_por?: string;
}