import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { OrthographyCheckUseCase } from './use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from './use-cases/profanity-check.usecase';
import { SanitizerUseCase } from './use-cases/sanitizer.usecase';
import { TrackMetricsUseCase } from './use-cases/track-metrics.usecase';
import { HistoryManagerUseCase } from './use-cases/history-manager.usecase';
import { JelpyAssistantService } from './jelpy-assistant/jelpy-assistant.service';

/**
 * 🤖 Servicio central de IA
 * Ejecuta el pipeline completo de procesamiento:
 * 1️⃣ Sanitiza texto
 * 2️⃣ Corrige ortografía
 * 3️⃣ Detecta groserías
 * 4️⃣ Guarda historial
 * 5️⃣ Envía a JelpyAssistant para interpretar
 * 6️⃣ Registra métricas
 */
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
   * 🧠 Procesa un mensaje completo del usuario.
   */
  async processUserMessage(input: string, usuarioId?: number, contexto?: { ip?: string; userAgent?: string }) {
    this.logger.debug(`🧩 Procesando mensaje del usuario: "${input}"`);

    // 1️⃣ Sanitizar texto (limpia caracteres, espacios, HTML, etc.)
    const textoLimpio = this.sanitizerUseCase.execute(input);

    // 2️⃣ Corrección ortográfica
    const textoCorregido = await this.orthographyUseCase.execute(textoLimpio);

    // 3️⃣ Revisión de lenguaje inapropiado
    const moderacion = await this.profanityUseCase.execute(textoLimpio, textoCorregido, {
      ip: contexto?.ip,
      userAgent: contexto?.userAgent,
      usuarioId,
    });

    if (!moderacion.permitido) {
      this.logger.warn(`🚫 Mensaje bloqueado por lenguaje inapropiado: "${input}"`);
      return {
        status: 'rechazado',
        motivo: moderacion.motivo,
        palabraDetectada: moderacion.palabra,
      };
    }

    // 4️⃣ Guardar historial de consulta
    await this.historyUseCase.saveQuery(usuarioId ?? 0, textoCorregido);

    // 5️⃣ Enviar al motor Jelpy para interpretar intención
    const respuesta = await this.jelpyAssistant.interpretar(textoCorregido);

    // 6️⃣ Registrar métrica de búsqueda
    await this.trackMetricsUseCase.execute('busqueda', 'sucursal', usuarioId ?? 0);

    // ✅ Respuesta final estructurada
    return {
      status: 'aceptado',
      mensajeOriginal: input,
      mensajeCorregido: textoCorregido,
      respuesta,
    };
  }

  /**
   * 🔍 Método interno para interpretar consultas sin ejecutar todo el pipeline.
   */
  async interpretQuery(query: string) {
    const limpio = this.sanitizerUseCase.execute(query);
    const corregido = await this.orthographyUseCase.execute(limpio);
    return this.jelpyAssistant.interpretar(corregido);
  }
}
