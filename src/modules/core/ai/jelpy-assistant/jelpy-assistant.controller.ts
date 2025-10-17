import { Controller, Post, Body, Req } from '@nestjs/common';
import { JelpyAssistantService } from './jelpy-assistant.service';
import { OrthographyCheckUseCase } from '../use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from '../use-cases/profanity-check.usecase';
import { TrackMetricsUseCase } from '../use-cases/track-metrics.usecase';

/**
 * Controlador principal del asistente Jelpy
 * - Corrige ortografía
 * - Modera lenguaje
 * - Interpreta intención
 * - Registra métricas
 */
@Controller('jelpy-assistant')
export class JelpyAssistantController {
  constructor(
    private readonly jelpyService: JelpyAssistantService,
    private readonly orthoUseCase: OrthographyCheckUseCase,
    private readonly profanityUseCase: ProfanityCheckUseCase,
    private readonly metricsUseCase: TrackMetricsUseCase,
  ) {}

  /**
   * 🔹 Endpoint principal: interpreta el mensaje del usuario.
   * Acepta también latitud y longitud para búsquedas "cerca de mí"
   */
  @Post('interpretar')
  async interpretar(
    @Body('mensaje') mensaje: string,
    @Body('suscriptorId') suscriptorId: number,
    @Req() req: any,
    @Body('latitud') latitud?: number,
    @Body('longitud') longitud?: number,
  ) {
    if (!mensaje || mensaje.trim().length === 0) {
      return {
        status: 'error',
        mensaje: 'Debes enviar un mensaje para interpretar.',
      };
    }

    // 1️⃣ Corrección ortográfica
    const textoCorregido = await this.orthoUseCase.execute(mensaje);

    // 2️⃣ Revisión de lenguaje inapropiado
    const moderacion = await this.profanityUseCase.execute(mensaje, textoCorregido, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      usuarioId: suscriptorId,
    });

    if (!moderacion.permitido) {
      return {
        status: 'rechazado',
        mensaje: 'Tu mensaje contiene lenguaje inapropiado. Por favor modula tu lenguaje 💬🙂',
        motivo: moderacion.motivo,
      };
    }

    // 3️⃣ Interpretar intención (detecta ciudad, categoría, "cerca de mí", etc.)
    const resultado = await this.jelpyService.interpretar(textoCorregido, latitud, longitud);

    // 4️⃣ Registrar métrica de búsqueda
    try {
      await this.metricsUseCase.execute('busqueda', 'sucursal', suscriptorId);
    } catch (error) {
      console.warn('⚠️ No se pudo registrar la métrica:', error.message);
    }

    // 5️⃣ Devolver resultado completo
    return {
      status: 'aceptado',
      mensajeOriginal: mensaje,
      mensajeCorregido: textoCorregido,
      ...resultado,
    };
  }
}
