import { IsEnum, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ResetPeriodo } from '../entities/membresia-cuotas.entity';

export class UpsertMembresiaCuotasDto {
  @IsInt()
  @Min(1)
  membresiaId: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxNegocios?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxPromociones?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxAnuncios?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSucursales?: number;

  @IsOptional()
  @IsEnum(['mensual', 'anual', 'una_vez'] as const)
  resetPeriodo?: ResetPeriodo;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  permitePromosDestacadas?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  permiteAnunciosPremium?: boolean;
}
