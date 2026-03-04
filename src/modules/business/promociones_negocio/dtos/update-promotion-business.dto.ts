import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionBusinessDto } from './create-promotion-business.dto';
import { IsArray, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePromotionBusinessDto extends PartialType(CreatePromotionBusinessDto) {
  @IsOptional()
  @IsBoolean()
  actualizarSucursales?: boolean; // si true, se reemplazan asociaciones

  @IsOptional()
  @IsArray()
  sucursalIds?: number[];
}