import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCaracteristicaAliasDto {
  @IsNumber()
  @Type(() => Number)
  caracteristicaId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  alias: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}