/**
 * MemoryCacheService — caché en memoria acotada, con TTL y expulsión LRU.
 * ------------------------------------------------------------------------------
 * Motivación (auditoría de rendimiento):
 *   - Los catálogos (ciudades, estados, categorías, especialidades) cambian muy
 *     rara vez pero se leen en casi todas las pantallas; hoy se recalculan en
 *     cada request (incluye round-trips a la BD y payloads grandes, p.ej.
 *     GET /especialidades ≈ 442 KB). Cachear esas lecturas elimina el trabajo
 *     repetido SIN cambiar el shape de la respuesta (transparente para clientes).
 *   - La auditoría también señaló cachés ad-hoc con `Map` SIN cota ni expulsión
 *     (riesgo de fuga de memoria en un heap de 512 MB). Este primitivo es
 *     deliberadamente ACOTADO: `maxEntries` + expulsión del más antiguo.
 *
 * Diseño:
 *   - `get` respeta el TTL (expira perezosamente) y refresca el orden de uso
 *     (LRU aproximado: al leer, la entrada se reinserta al final del Map).
 *   - `set` expulsa la entrada más antigua cuando se alcanza `maxEntries`.
 *   - `wrap` es el helper de conveniencia: devuelve el valor cacheado o ejecuta
 *     el `loader`, guarda y devuelve. Nunca cachea `undefined`.
 *   - `delByPrefix` permite invalidar familias de claves tras una escritura.
 *
 * Alcance: proceso único (in-memory). Si se escala horizontalmente, cada
 * instancia tiene su propia copia; la coherencia entre instancias queda acotada
 * por el TTL. Para invalidación global inmediata se requeriría un backend
 * compartido (Redis), fuera del alcance de este cambio.
 */
import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class MemoryCacheService {
  private readonly store = new Map<string, CacheEntry>();

  /** Máximo de entradas vivas. Los catálogos son pocos; 500 es holgado. */
  private readonly maxEntries = 500;

  /** TTL por defecto: 5 minutos. Suficiente para catálogos casi estáticos. */
  static readonly DEFAULT_TTL_MS = 5 * 60 * 1000;

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // LRU aproximado: reinserta para marcar como "usada recientemente".
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs = MemoryCacheService.DEFAULT_TTL_MS): void {
    if (value === undefined) return; // no cachear ausencia de valor

    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      // Expulsa la entrada más antigua (primer key insertado).
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }

    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Devuelve el valor cacheado o ejecuta `loader`, cachea y devuelve. */
  async wrap<T>(
    key: string,
    loader: () => Promise<T>,
    ttlMs = MemoryCacheService.DEFAULT_TTL_MS,
  ): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;

    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }

  del(key: string): void {
    this.store.delete(key);
  }

  /** Invalida todas las claves que empiecen por `prefix` (tras una escritura). */
  delByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  /** Solo para pruebas/diagnóstico. */
  size(): number {
    return this.store.size;
  }
}
