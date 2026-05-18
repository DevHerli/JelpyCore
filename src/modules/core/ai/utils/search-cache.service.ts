import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Cache en memoria para resultados de búsqueda frecuentes.
 * Clave: `ciudad:categoriaId:subcategoriaId`  (subcategoriaId puede ser 'null')
 * TTL: 5 minutos
 */
@Injectable()
export class SearchCacheService {
  private readonly logger = new Logger(SearchCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutos

  private buildKey(
    ciudad: string,
    categoriaId: number | null,
    subcategoriaId: number | null,
  ): string {
    return `${(ciudad || 'any').toLowerCase()}:${categoriaId ?? 'null'}:${subcategoriaId ?? 'null'}`;
  }

  get<T>(
    ciudad: string,
    categoriaId: number | null,
    subcategoriaId: number | null,
  ): T | null {
    const key = this.buildKey(ciudad, categoriaId, subcategoriaId);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.debug(`Cache expirado para: ${key}`);
      return null;
    }

    this.logger.debug(`Cache HIT para: ${key}`);
    return entry.data as T;
  }

  set<T>(
    ciudad: string,
    categoriaId: number | null,
    subcategoriaId: number | null,
    data: T,
  ): void {
    const key = this.buildKey(ciudad, categoriaId, subcategoriaId);
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.TTL_MS,
    });
    this.logger.debug(`Cache SET para: ${key} (${this.cache.size} entradas total)`);
  }

  invalidate(
    ciudad: string,
    categoriaId: number | null,
    subcategoriaId: number | null,
  ): void {
    const key = this.buildKey(ciudad, categoriaId, subcategoriaId);
    this.cache.delete(key);
  }

  /** Limpia todas las entradas expiradas */
  limpiar(): void {
    const ahora = Date.now();
    let removidas = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (ahora > entry.expiresAt) {
        this.cache.delete(key);
        removidas++;
      }
    }
    if (removidas > 0) {
      this.logger.debug(`Cache limpiado: ${removidas} entradas expiradas eliminadas`);
    }
  }

  get size(): number {
    return this.cache.size;
  }
}
