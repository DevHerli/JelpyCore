import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MessageType } from '../entities/business-message.entity';

/**
 * DTO para crear un mensaje desde servicios internos / cron jobs.
 * No expuesto en endpoints públicos.
 */
export class CreateMessageDto {
  @IsNumber()
  subscriberId: number;

  @IsEnum(['payment', 'report', 'system', 'promotion', 'insight'])
  type: MessageType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  preview: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  senderName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ctaRoute?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
