import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';

export class ConsumirCuotaDto {
  @IsInt()
  @IsPositive()
  suscriptorId: number;

  @IsEnum(['negocios', 'promociones', 'anuncios'] as const)
  tipo: 'negocios' | 'promociones' | 'anuncios';

  // Opcional: referencia al recurso creado (negocio/promocion/anuncio)
  @IsOptional()
  @IsInt()
  @IsPositive()
  referenciaId?: number;
}