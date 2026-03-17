import { Controller, Post, Body, Logger, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import { TrackMetricsUseCase } from '../ai/use-cases/track-metrics.usecase';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly metricsUseCase: TrackMetricsUseCase,
  ) {}

  /**
   * Endpoint principal para procesar mensajes
   */
  @Post('process')
  async procesarMensaje(
    @Body('mensaje') mensaje: string,
    @Body('usuarioId') usuarioId?: number,

    // AGREGADO: contexto opcional para lat/lng/ciudad
    @Body('contexto') contexto?: {
      latitud?: number;
      longitud?: number;
      ciudad?: string;
      ip?: string;
      userAgent?: string;
    },
  ) {
    if (!mensaje) {
      throw new BadRequestException('El campo "mensaje" es obligatorio');
    }

    this.logger.log(`Mensaje recibido: ${mensaje}`);

    // Pasamos también el contexto al AiService (sin romper nada tuyo)
    const resultado = await this.aiService.processUserMessage(
      mensaje,
      usuarioId,
      contexto,
    );

    const respuesta: any = resultado?.respuesta ?? {};
    const items: any[] = Array.isArray(respuesta.items) ? respuesta.items : [];

    /**
     * Registrar métricas SOLO si hay sucursales válidas
     * ESTO LO RESPETO EXACTAMENTE COMO LO TENÍAS
     */
    if (items.length > 0) {
      try {
        for (const item of items) {
          const sucursalId =
            item.sucursal_id ||
            item.sucursalId ||
            item.id_sucursal ||
            item.sucursal?.id ||
            null;

          if (sucursalId) {
            await this.metricsUseCase.execute('busqueda', 'sucursal', Number(sucursalId));
          }
        }
      } catch (error) {
        this.logger.error('Error registrando métricas', error);
      }
    }

    return {
      exito: true,
      data: resultado,
    };
  }



  /**
   * Solo interpretar (sin pipeline completo)
   */
  @Post('interpret')
  async interpretarQuery(@Body('query') query: string) {
    if (!query) {
      throw new BadRequestException('El campo "query" es obligatorio');
    }

    this.logger.log(`Interpretando consulta: ${query}`);

    const interpretacion = await this.aiService.interpretQuery(query);

    return {
      exito: true,
      interpretacion,
    };
  }
}
