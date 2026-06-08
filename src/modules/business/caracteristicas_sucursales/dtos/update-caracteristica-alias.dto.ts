import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCaracteristicaAliasDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  alias?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}