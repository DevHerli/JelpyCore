import { Injectable, Logger } from '@nestjs/common';

interface RateEntry {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter en memoria por sessionId o IP.
 * Límite: 30 mensajes por minuto por sesión.
 * Se limpia automáticamente cada 5 minutos para evitar memory leaks.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly map = new Map<string, RateEntry>();
  private readonly MAX_PER_MINUTE = 30;
  private readonly WINDOW_MS = 60_000; // 1 minuto

  constructor() {
    // Limpieza periódica cada 5 minutos.
    // JLP-TEST-CLEANUP-FIX: .unref() evita que este timer mantenga vivo el
    // proceso (o un worker de Jest) solo por sí mismo — detectado porque la
    // nueva suite de pruebas de ai.service.spec.ts usa una instancia real
    // de RateLimiterService y Jest reportaba "worker process has failed to
    // exit gracefully" por este handle nunca liberado.
    setInterval(() => this.limpiar(), 5 * 60 * 1000).unref();
  }

  /**
   * Verifica si la clave (sessionId o IP) puede hacer una petición.
   * @returns true = permitido, false = bloqueado
   */
  verificar(clave: string): boolean {
    const ahora = Date.now();
    const entry = this.map.get(clave);

    if (!entry || ahora > entry.resetAt) {
      this.map.set(clave, { count: 1, resetAt: ahora + this.WINDOW_MS });
      return true;
    }

    if (entry.count >= this.MAX_PER_MINUTE) {
      this.logger.warn(`Rate limit alcanzado para: ${clave} (${entry.count} msgs/min)`);
      return false;
    }

    entry.count++;
    return true;
  }

  /** Tiempo restante en segundos hasta el reset */
  tiempoRestante(clave: string): number {
    const entry = this.map.get(clave);
    if (!entry) return 0;
    return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000));
  }

  private limpiar(): void {
    const ahora = Date.now();
    let removidas = 0;
    for (const [key, entry] of this.map.entries()) {
      if (ahora > entry.resetAt) {
        this.map.delete(key);
        removidas++;
      }
    }
    if (removidas > 0) {
      this.logger.debug(`Rate limiter: ${removidas} entradas limpiadas`);
    }
  }
}
