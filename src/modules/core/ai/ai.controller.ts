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

  @Post('process')
  async procesarMensaje(
    @Body('mensaje') mensaje: string,
    @Body('ciudad') ciudad?: string,           
    @Body('usuarioId') usuarioId?: number,
    @Body('latitud') latitud?: number,
    @Body('longitud') longitud?: number,
  ) {
    if (!mensaje) {
      throw new BadRequestException('El campo "mensaje" es obligatorio');
    }

    this.logger.log(`Mensaje recibido: ${mensaje}`);

    const resultado = await this.aiService.processUserMessage(
      mensaje,
      usuarioId,
      {
        ciudad,               // ✅ ← ENVIADO A AiService
        latitud,
        longitud,
      }
    );

    const respuesta: any = resultado?.respuesta ?? {};
    const items: any[] = Array.isArray(respuesta.items) ? respuesta.items : [];

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
