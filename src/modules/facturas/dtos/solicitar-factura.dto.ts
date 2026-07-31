import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class SolicitarFacturaDto {
  @IsNumber()
  @Min(1)
  suscriptorId: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pagoId?: number;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  concepto?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCentavos?: number;
}
