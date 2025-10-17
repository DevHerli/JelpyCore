import { Controller, Post, Body, Logger } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Endpoint principal para procesar mensajes del usuario.
   * Pasa por todo el pipeline: limpieza, ortografía, groserías, métricas, JelpyAssistant.
   *
   * POST /ai/process
   * {
   *   "mensaje": "busca un restaurante de sushi en tepic",
   *   "usuarioId": 12
   * }
   */
  @Post('process')
  async procesarMensaje(@Body('mensaje') mensaje: string, @Body('usuarioId') usuarioId?: number) {
    this.logger.log(`🧩 Mensaje recibido: ${mensaje}`);
    const resultado = await this.aiService.processUserMessage(mensaje, usuarioId);
    return {
      exito: true,
      data: resultado,
    };
  }

  /**
   * 🔍 Endpoint secundario para solo interpretar una consulta (sin procesar todo el flujo)
   *
   * POST /ai/interpret
   * {
   *   "query": "farmacias abiertas en nayarit"
   * }
   */
  @Post('interpret')
  async interpretarQuery(@Body('query') query: string) {
    this.logger.log(`🧠 Interpretando consulta: ${query}`);
    const interpretacion = await this.aiService.interpretQuery(query);
    return {
      exito: true,
      interpretacion,
    };
  }
}
