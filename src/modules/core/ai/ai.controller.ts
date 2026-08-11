import { Controller, Post, Get, Delete, Param, Body, Query, Req, UseGuards, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { TrackMetricsUseCase } from '../ai/use-cases/track-metrics.usecase';
import { ConversationService } from '../conversation/conversation.service';

// JLP-H21 — Endpoints LLM/conversación: autenticación + rate-limit. La
// identidad proviene del token y el historial/cierre de sesión se restringe
// al dueño de la sesión (o admin).
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly metricsUseCase: TrackMetricsUseCase,
    private readonly conversationService: ConversationService,
  ) {}

  private requester(req: any): { sub: number; isAdmin: boolean } {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  /**
   * Endpoint principal para procesar mensajes con memoria de sesión.
   *
   * El frontend debe enviar un `sessionId` (UUID) que se genera al abrir el chat
   * y se mantiene mientras dure la conversación. Esto permite que Jelpy recuerde
   * el contexto de mensajes anteriores dentro de la misma sesión.
   *
   * Body esperado:
   * {
   *   mensaje: string,
   *   sessionId?: string,   ← UUID de la sesión (frontend lo genera)
   *   usuarioId?: number,
   *   contexto?: {
   *     latitud?: number,
   *     longitud?: number,
   *     ciudad?: string,
   *     ip?: string,
   *     userAgent?: string
   *   }
   * }
   */
  @Post('process')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60 } })
  async procesarMensaje(
    @Req() req: any,
    @Body('mensaje') mensaje: string,
    @Body('sessionId') sessionId?: string,
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

    // La identidad se toma del token, ignorando cualquier usuarioId del body.
    const usuarioId = Number(req.user?.sub);

    this.logger.log(`[Session: ${sessionId ?? 'sin sesión'}] Mensaje: "${mensaje}"`);

    const resultado = await this.aiService.processUserMessage(
      mensaje,
      usuarioId,
      contexto,
      sessionId,
    );

    const respuesta: any = resultado?.respuesta ?? {};
    const items: any[] = Array.isArray(respuesta.items) ? respuesta.items : [];

    // Registrar métricas de búsqueda si hay resultados
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
      sessionId: resultado.sessionId,   // ← devolvemos el sessionId al frontend
      data: resultado,
    };
  }

  /**
   * Historial de conversación de una sesión.
   * El frontend puede llamarlo al abrir el chat para mostrar mensajes previos.
   *
   * GET /ai/historial/:sessionId
   */
  @Get('historial/:sessionId')
  @UseGuards(JwtAuthGuard)
  async obtenerHistorial(
    @Param('sessionId') sessionId: string,
    @Req() req: any,
  ) {
    if (!sessionId) {
      throw new BadRequestException('El sessionId es obligatorio');
    }

    const sesion = await this.conversationService.obtenerContextoSesion(sessionId);

    if (!sesion) {
      throw new NotFoundException('Sesión no encontrada o expirada');
    }

    // Solo el dueño de la sesión (o un admin) puede leer su historial.
    const requester = this.requester(req);
    if (
      !requester.isAdmin &&
      (sesion.usuarioId == null ||
        Number(sesion.usuarioId) !== requester.sub)
    ) {
      throw new ForbiddenException('No tienes acceso a esta sesión');
    }

    const turnos = await this.conversationService.obtenerHistorial(sessionId);

    // Invertimos para que vengan en orden cronológico (más viejo primero)
    const historial = turnos.reverse().map((t) => ({
      id: t.id,
      rol: t.rol,
      mensaje: t.mensaje,
      intent: t.intent,
      fecha: t.creadoEn,
    }));

    return {
      exito: true,
      sessionId,
      ciudad: sesion.ciudad,
      ultimoIntent: sesion.ultimoIntent,
      totalTurnos: historial.length,
      historial,
    };
  }

  /**
   * Cierra explícitamente una sesión (ej: al cerrar la app o hacer logout).
   *
   * DELETE /ai/sesion/:sessionId
   */
  @Delete('sesion/:sessionId')
  @UseGuards(JwtAuthGuard)
  async cerrarSesion(
    @Param('sessionId') sessionId: string,
    @Req() req: any,
  ) {
    if (!sessionId) {
      throw new BadRequestException('El sessionId es obligatorio');
    }

    // Verificar propiedad antes de cerrar (evita cerrar sesiones ajenas).
    const sesion = await this.conversationService.obtenerContextoSesion(sessionId);
    if (sesion) {
      const requester = this.requester(req);
      if (
        !requester.isAdmin &&
        (sesion.usuarioId == null ||
          Number(sesion.usuarioId) !== requester.sub)
      ) {
        throw new ForbiddenException('No tienes acceso a esta sesión');
      }
      await this.conversationService.cerrarSesion(sessionId);
    }

    return {
      exito: true,
      mensaje: 'Sesión cerrada correctamente',
    };
  }

  /**
   * Autocompletado de búsqueda — instantáneo, sin DB.
   * GET /ai/autocomplete?q=tac&ciudad=Culiacán
   */
  @Get('autocomplete')
  autocomplete(
    @Query('q') q: string,
    @Query('ciudad') ciudad?: string,
  ) {
    if (!q || q.trim().length < 2) {
      return { exito: true, sugerencias: [] };
    }
    const sugerencias = this.aiService.autocomplete(q, ciudad);
    return { exito: true, sugerencias };
  }

  /**
   * Solo interpretar (sin pipeline completo, sin sesión)
   */
  @Post('interpret')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60 } })
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
