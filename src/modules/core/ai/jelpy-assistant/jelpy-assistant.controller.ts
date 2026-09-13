import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { JelpyAssistantService } from './jelpy-assistant.service';
import { OrthographyCheckUseCase } from '../use-cases/orthography-check.usecase';
import { ProfanityCheckUseCase } from '../use-cases/profanity-check.usecase';
import { TrackMetricsUseCase } from '../use-cases/track-metrics.usecase';
import { SafetyPolicy } from '../utils/safety-policy';
import { SearchTrendLoggerUseCase } from '../use-cases/search-trend-logger.usecase';

/**
 * Controlador principal del asistente Jelpy
 * - Corrige ortografía
 * - Modera lenguaje
 * - Interpreta intención
 * - Registra métricas
 */
// JLP-H21 — Endpoint LLM (costo/abuso): requiere autenticación + rate-limit
// dedicado. La identidad (suscriptorId) proviene del token, no del body.
@Controller('jelpy-assistant')
export class JelpyAssistantController {
  constructor(
    private readonly jelpyService: JelpyAssistantService,
    private readonly orthoUseCase: OrthographyCheckUseCase,
    private readonly profanityUseCase: ProfanityCheckUseCase,
    private readonly metricsUseCase: TrackMetricsUseCase,
    private readonly searchTrendLogger: SearchTrendLoggerUseCase,
  ) {}

  /**
   * Endpoint principal: interpreta el mensaje del usuario.
   * Acepta también latitud y longitud para búsquedas "cerca de mí"
   */
  @Post('interpretar')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60 } })
  async interpretar(
    @Body('mensaje') mensaje: string,
    @Req() req: any,
    @Body('latitud') latitud?: number,
    @Body('longitud') longitud?: number,
    @Body('filtersApplied') filtersApplied?: string[],
  ) {
    // La identidad se toma del token, ignorando cualquier suscriptorId del body.
    const suscriptorId = Number(req.user?.sub);

    if (!mensaje || mensaje.trim().length === 0) {
      return {
        status: 'error',
        mensaje: 'Debes enviar un mensaje para interpretar.',
      };
    }

    // Corrección ortográfica
    const textoCorregido = await this.orthoUseCase.execute(mensaje);

    // Revisión de lenguaje inapropiado
    const moderacion = await this.profanityUseCase.execute(
      mensaje,
      textoCorregido,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        usuarioId: suscriptorId,
      },
    );

    if (!moderacion.permitido) {
      return {
        status: 'rechazado',
        mensaje:
          'Tu mensaje contiene lenguaje inapropiado. Por favor modula tu lenguaje 💬🙂',
        motivo: moderacion.motivo,
      };
    }

    const seguridad = SafetyPolicy.check(textoCorregido);

    if (seguridad.blocked) {
      return {
        status: 'bloqueado',
        motivo: seguridad.category,
        mensajeOriginal: mensaje,
        mensajeCorregido: textoCorregido,
        filtros_detectados: { intent: 'bloqueado', motivo: seguridad.category },
        resultados: { items: [] },
        sin_resultados: false,
        mensaje_sin_resultados: null,
        respuesta: {
          titulo: seguridad.title,
          mensaje: seguridad.message,
          sugerencias: [],
        },
        titulo: seguridad.title,
        mensaje: seguridad.message,
        suggestedQueries: [],
      };
    }

    // 3️⃣ Interpretar intención (detecta ciudad, categoría, "cerca de mí", etc.)
    const resultado = await this.jelpyService.interpretar(
      textoCorregido,
      latitud,
      longitud,
      undefined,        // ciudadManual
      suscriptorId,
      Array.isArray(filtersApplied) ? filtersApplied : [],
    );

    // ======================================================
    // 4️⃣ Registrar métrica de búsqueda (CORREGIDO)
    // Tomamos la primera sucursal real encontrada
    // ======================================================
    try {
      const sucursalIdReal =
        resultado?.resultados?.items?.[0]?.sucursal_id ?? null;

      if (sucursalIdReal) {
        await this.metricsUseCase.execute(
          'busqueda',
          'sucursal',
          Number(sucursalIdReal),
        );
      }
    } catch (error) {
      console.warn('⚠️ No se pudo registrar la métrica:', error.message);
    }

    try {
      const items = Array.isArray(resultado?.resultados)
        ? resultado.resultados
        : resultado?.resultados?.items ?? [];
      const filtros = resultado?.filtros_detectados ?? {};
      const primerItem = items[0] ?? {};

      this.searchTrendLogger
        .execute({
          usuarioId: suscriptorId || null,
          sessionId: null,
          queryOriginal: mensaje,
          queryNormalizada: textoCorregido,
          ciudad: filtros.ciudad ?? primerItem.ciudad ?? null,
          categoriaId: filtros.categoriaId ?? filtros.categoria_id ?? null,
          subcategoriaId: filtros.subcategoriaId ?? filtros.subcategoria_id ?? null,
          especialidadId: filtros.especialidadId ?? filtros.especialidad_id ?? null,
          categoriaNombre:
            filtros.categoriaNombre ??
            filtros.categoria ??
            primerItem.categoria ??
            primerItem.categoria_nombre ??
            null,
          subcategoriaNombre:
            filtros.subcategoriaNombre ??
            filtros.subcategoria ??
            primerItem.subcategoria ??
            primerItem.subcategoria_nombre ??
            null,
          especialidadNombre:
            filtros.especialidadNombre ??
            filtros.especialidad ??
            primerItem.especialidad ??
            primerItem.especialidad_nombre ??
            null,
          intent: filtros.intent ?? 'buscar_negocios',
          totalResultados: items.length,
          sinResultados: items.length === 0,
          lat: latitud ?? null,
          lng: longitud ?? null,
        })
        .catch(() => null);
    } catch (error) {
      console.warn('⚠️ No se pudo registrar Jelpy Trend:', error.message);
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
