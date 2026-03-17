import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class EstadoCuentaQueryDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  offset?: number;
}