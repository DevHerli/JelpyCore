import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MessageType } from '../entities/business-message.entity';

export type AdminTargetType = 'individual' | 'segment' | 'all';

export class SendMessageAdminDto {
  // ─── Destino ────────────────────────────────────────────────────────────────

  /**
   * individual → enviar a un suscriptor concreto (target_value = subscriber_id)
   * segment    → enviar a todos los suscriptores de una ciudad (target_value = ciudad_id)
   * all        → enviar a TODOS los suscriptores activos
   */
  @IsEnum(['individual', 'segment', 'all'])
  target_type: AdminTargetType;

  /**
   * ID del suscriptor (target_type = 'individual')
   * ID de la ciudad  (target_type = 'segment')
   * null             (target_type = 'all')
   */
  @IsOptional()
  @IsString()
  target_value?: string | null;

  // ─── Contenido del mensaje ───────────────────────────────────────────────────

  @IsEnum(['payment', 'report', 'system', 'promotion', 'insight'])
  type: MessageType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  /**
   * Resumen corto (~120 chars) visible en la lista.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  preview: string;

  /**
   * Cuerpo completo del mensaje (párrafos separados por \n\n).
   */
  @IsString()
  @IsNotEmpty()
  body: string;

  /**
   * Nombre del remitente. Ej: "Equipo Jelpy Negocios"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  sender_name: string;

  // ─── CTA opcional ───────────────────────────────────────────────────────────

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cta_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cta_route?: string;

  // ─── Metadata opcional ──────────────────────────────────────────────────────

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
