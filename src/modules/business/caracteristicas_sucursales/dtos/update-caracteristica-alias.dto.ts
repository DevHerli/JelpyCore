import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCaracteristicaAliasDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  alias?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activo?: boolean;
}