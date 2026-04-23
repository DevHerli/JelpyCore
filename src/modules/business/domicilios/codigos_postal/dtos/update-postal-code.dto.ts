import { PartialType } from '@nestjs/mapped-types';
import { CreatePostalCodeDto } from './create-postal-code.dto';
import { IsNumberString, IsOptional } from 'class-validator';

export class UpdatePostalCodeDto extends PartialType(CreatePostalCodeDto) {
  @IsOptional()
  @IsNumberString()
  actualizado_por?: string;
}