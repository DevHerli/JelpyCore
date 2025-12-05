import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { OrthographyCheckUseCase } from './use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from './use-cases/profanity-check.usecase';
import { SanitizerUseCase } from './use-cases/sanitizer.usecase';
import { TrackMetricsUseCase } from './use-cases/track-metrics.usecase';
import { HistoryManagerUseCase } from './use-cases/history-manager.usecase';
import { JelpyAssistantService } from './jelpy-assistant/jelpy-assistant.service';
import { AIResponseBuilder } from './utils/ai-response-builder';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly orthographyUseCase: OrthographyCheckUseCase,
    private readonly profanityUseCase: ProfanityCheckUseCase,
    private readonly sanitizerUseCase: SanitizerUseCase,
    private readonly trackMetricsUseCase: TrackMetricsUseCase,
    private readonly historyUseCase: HistoryManagerUseCase,

    @Inject(forwardRef(() => JelpyAssistantService))
    private readonly jelpyAssistant: JelpyAssistantService,
  ) {}

  /**
   * NO SE CAMBIA la firma, así sigue recibiendo 3 parámetros.
   * latitud y longitud VIAJAN dentro del objeto "contexto".
   */
  async processUserMessage(
    input: string,
    usuarioId?: number,
    contexto?: { 
      ip?: string; 
      userAgent?: string; 
      latitud?: number; 
      longitud?: number; 
    },
  ) {
    this.logger.debug(`Procesando mensaje: "${input}"`);

    const latitud = contexto?.latitud ?? null;
    const longitud = contexto?.longitud ?? null;

    const textoLimpio = this.sanitizerUseCase.execute(input);
    const textoCorregido = await this.orthographyUseCase.execute(textoLimpio);

    // 🔍 Moderación
    const moderacion = await this.profanityUseCase.execute(
      textoLimpio,
      textoCorregido,
      {
        ip: contexto?.ip ?? null,
        userAgent: contexto?.userAgent ?? null,
        usuarioId: usuarioId ?? null,
      },
    );

    if (!moderacion.permitido) {
      this.logger.warn(`🚫 Mensaje bloqueado: "${input}"`);
      return {
        status: 'rechazado',
        motivo: moderacion.motivo,
        palabraDetectada: moderacion.palabra,
      };
    }

    // 📝 Historial
    await this.historyUseCase.saveQuery(usuarioId ?? 0, textoCorregido);

    // 🤖 Interpretación con GPS SI LO ENVIARON
    const interpretacion = await this.jelpyAssistant.interpretar(
      textoCorregido,
      latitud ?? undefined,
      longitud ?? undefined,
    );

    // ===============================================
    // NORMALIZACIÓN DE RESULTADOS
    // ===============================================
    const items = Array.isArray(interpretacion.resultados)
      ? interpretacion.resultados
      : interpretacion.resultados.items ?? [];

    // ===============================================
    // 📊 REGISTRAR MÉTRICAS SOLO SI HAY SUCURSAL
    // ===============================================
    try {
      for (const item of items) {
        const sucursalId =
          item.sucursal_id ||
          item.sucursalId ||
          item.id_sucursal ||
          item.sucursal?.id ||
          null;

        if (sucursalId) {
          await this.trackMetricsUseCase.execute(
            'busqueda',
            'sucursal',
            Number(sucursalId),
          );
        }
      }
    } catch (err) {
      this.logger.error('❌ Error registrando métricas', err);
    }

    // 💬 Respuesta amigable
    const friendly = AIResponseBuilder.buildFriendlyResponse(
      interpretacion.filtros_detectados,
      items
    );
    

    return {
      status: 'aceptado',
      mensajeOriginal: input,
      mensajeCorregido: textoCorregido,
      respuesta: friendly,
      debug: {
        filtros: interpretacion.filtros_detectados,
        totalResultados: items.length,
      },
    };
  }

  async interpretQuery(query: string) {
    const limpio = this.sanitizerUseCase.execute(query);
    const corregido = await this.orthographyUseCase.execute(limpio);
    return this.jelpyAssistant.interpretar(corregido);
  }
}
