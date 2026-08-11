import {
  IsNumber,
  IsPositive,
  IsOptional,
  IsObject,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CheckoutSessionDto {
  /** ID del suscriptor autenticado (se valida contra el JWT). */
  @IsNumber()
  @IsPositive()
  suscriptorId: number;

  /** Plan elegido: debe ser un membresiaId con precio > 0 y stripePriceId configurado. */
  @IsNumber()
  @IsPositive()
  membresiaId: number;

  /**
   * Negocio existente al que se quiere mejorar el plan.
   * Se omite (o se pasa 0) cuando el negocio se crea junto con el pago.
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  negocioId?: number;

  /**
   * Datos para crear el negocio si aún no existe.
   * El negocio se crea SOLO cuando el webhook confirma el pago (no aquí).
   * Se serializa en la metadata de la Checkout Session y se recupera en el webhook.
   */
  @IsOptional()
  @IsObject()
  negocioData?: Record<string, any>;
}
