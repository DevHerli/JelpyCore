import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZeroResultQuery } from '../zero-result/entities/zero-result-query.entity';

/**
 * Registra búsquedas que no arrojaron resultados.
 * Dato crítico de negocio: revela qué categorías/negocios faltan en el catálogo.
 */
@Injectable()
export class ZeroResultLoggerUseCase {
  private readonly logger = new Logger(ZeroResultLoggerUseCase.name);

  constructor(
    @InjectRepository(ZeroResultQuery)
    private readonly repo: Repository<ZeroResultQuery>,
  ) {}

  async execute(
    query: string,
    ciudad: string | null,
    filtros?: {
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      intent?: string | null;
    },
  ): Promise<void> {
    try {
      const registro = this.repo.create({
        query: query?.substring(0, 255) ?? '',
        ciudad: ciudad?.substring(0, 100) ?? null,
        categoriaId: filtros?.categoriaId ?? null,
        subcategoriaId: filtros?.subcategoriaId ?? null,
        intent: filtros?.intent?.substring(0, 100) ?? null,
      });
      await this.repo.save(registro);
      this.logger.log(`[ZeroResult] "${query}" en ${ciudad ?? 'sin ciudad'}`);
    } catch (err) {
      // No interrumpir el flujo si falla el logging
      this.logger.error('Error guardando zero-result query', err);
    }
  }
}
