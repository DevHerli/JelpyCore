import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchTrendEvent } from '../search-trends/entities/search-trend-event.entity';

type SearchTrendPayload = {
  usuarioId?: number | null;
  sessionId?: string | null;
  queryOriginal: string;
  queryNormalizada?: string | null;
  ciudad?: string | null;
  categoriaId?: number | null;
  subcategoriaId?: number | null;
  especialidadId?: number | null;
  categoriaNombre?: string | null;
  subcategoriaNombre?: string | null;
  especialidadNombre?: string | null;
  intent?: string | null;
  totalResultados?: number | null;
  sinResultados?: boolean | null;
  lat?: number | null;
  lng?: number | null;
};

@Injectable()
export class SearchTrendLoggerUseCase {
  private readonly logger = new Logger(SearchTrendLoggerUseCase.name);

  constructor(
    @InjectRepository(SearchTrendEvent)
    private readonly repo: Repository<SearchTrendEvent>,
  ) {}

  async execute(payload: SearchTrendPayload): Promise<void> {
    try {
      const now = new Date();

      const event = this.repo.create({
        usuarioId: this.toNumberOrNull(payload.usuarioId),
        sessionId: this.truncate(payload.sessionId, 80),
        queryOriginal: this.truncate(payload.queryOriginal, 500) || '',
        queryNormalizada: this.truncate(payload.queryNormalizada, 500),
        ciudad: this.truncate(payload.ciudad, 120),
        categoriaId: this.toNumberOrNull(payload.categoriaId),
        subcategoriaId: this.toNumberOrNull(payload.subcategoriaId),
        especialidadId: this.toNumberOrNull(payload.especialidadId),
        categoriaNombre: this.truncate(payload.categoriaNombre, 160),
        subcategoriaNombre: this.truncate(payload.subcategoriaNombre, 160),
        especialidadNombre: this.truncate(payload.especialidadNombre, 160),
        intent: this.truncate(payload.intent, 80),
        totalResultados: Math.max(0, Number(payload.totalResultados ?? 0) || 0),
        sinResultados: Boolean(payload.sinResultados),
        lat: this.toNumberOrNull(payload.lat),
        lng: this.toNumberOrNull(payload.lng),
        fecha: this.toLocalDate(now),
        hora: now.getHours(),
        diaSemana: now.getDay(),
      });

      await this.repo.save(event);
    } catch (err) {
      this.logger.error('Error guardando search trend event', err);
    }
  }

  private truncate(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    return text.substring(0, max);
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
