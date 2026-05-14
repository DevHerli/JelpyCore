import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MessageType } from '../entities/business-message.entity';

/**
 * Todos los campos son opcionales — solo se actualizan los que se envíen.
 * No se puede cambiar subscriber_id ni type de destino desde aquí.
 */
export class UpdateMessageAdminDto {
  @IsOptional()
  @IsEnum(['payment', 'report', 'system', 'promotion', 'insight'])
  type?: MessageType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  preview?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sender_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cta_label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cta_route?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> | null;
}
