import { IsIn, IsOptional, IsNumber } from 'class-validator';
import type { AnuncioEventType } from '../entities/anuncio-evento.entity';

export class TrackAnuncioEventDto {
  @IsIn(['view', 'click', 'like', 'whatsapp', 'call', 'maps'])
  eventType: AnuncioEventType;

  @IsOptional()
  @IsNumber()
  suscriptorId?: number;
}
