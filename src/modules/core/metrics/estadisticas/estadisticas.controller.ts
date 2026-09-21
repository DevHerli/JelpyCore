import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EstadisticasService, RequesterCtx, TIPOS_EVENTO_ESTADISTICA, TipoEventoEstadistica } from './estadisticas.service';
import { TrackEventoDto } from './dto/track-evento.dto';
import { BusquedaSinResultadosDto } from './dto/busqueda-sin-resultados.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../../../common/guards/admin.guard';

// METRICS-001: 'negocio'/'sucursal' llegan como string crudo desde el path
// param — se valida contra whitelist igual que `tipo` (ver
// registrarEvento más abajo). No se usa ParseEnumPipe porque TipoEventoEstadistica
// es un union type de strings, no un enum de TS.
const ENTIDADES_VALIDAS: Array<'negocio' | 'sucursal'> = ['negocio', 'sucursal'];

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  // JLP-M24: contexto del solicitante desde el token.
  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  // JLP-M24: tracking de eventos (vista/clic/búsqueda/llamada/whatsapp/
  // como_llegar) es anónimo por diseño (app pública + usecase de IA). Se
  // mitiga la inyección con rate-limit, no con auth.
  // METRICS-001: ahora valida con TrackEventoDto (class-validator + whitelist
  // global en main.ts) — antes aceptaba cualquier string en tipo/entidad.
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post('evento')
  registrarEventoBody(@Body() body: TrackEventoDto) {
    return this.estadisticasService.registrarEvento(body.tipo, body.entidad, body.id, body);
  }

  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post('busquedas-sin-resultados')
  registrarBusquedaSinResultados(@Body() body: BusquedaSinResultadosDto) {
    return this.estadisticasService.registrarBusquedaSinResultados(body);
  }

  // Registrar evento (vista, clic, búsqueda, llamada, whatsapp, como_llegar)
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post(':entidad/:id/:tipo')
  registrarEvento(
    @Param('entidad') entidad: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('tipo') tipo: string,
  ) {
    if (!ENTIDADES_VALIDAS.includes(entidad as 'negocio' | 'sucursal')) {
      throw new BadRequestException(`Entidad inválida: ${entidad}`);
    }
    if (!TIPOS_EVENTO_ESTADISTICA.includes(tipo as TipoEventoEstadistica)) {
      throw new BadRequestException(`Tipo de evento inválido: ${tipo}`);
    }
    return this.estadisticasService.registrarEvento(
      tipo as TipoEventoEstadistica,
      entidad as 'negocio' | 'sucursal',
      id,
    );
  }

  // JLP-M24: BI global de plataforma → solo admin.
  @UseGuards(AdminGuard)
  @Get('negocios')
  resumenNegocios() {
    return this.estadisticasService.resumenNegocios();
  }

  // JLP-M24: BI global de plataforma → solo admin.
  @UseGuards(AdminGuard)
  @Get('sucursales')
  resumenSucursales() {
    return this.estadisticasService.resumenSucursales();
  }

  // JLP-M24: BI global de plataforma → solo admin.
  @UseGuards(AdminGuard)
  @Get('resumen')
  resumenGlobal(
    @Query('ciudad_id') ciudadId?: number,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
  ) {
    return this.estadisticasService.resumenGlobal({
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      fechaInicio,
      fechaFin,
    });
  }

  /**
   * GET /estadisticas/negocios/global-metrics-resumen
   * Resumen liviano para listas. Evita llamar global-metrics N veces.
   */
  @UseGuards(JwtAuthGuard)
  @Get('negocios/global-metrics-resumen')
  getGlobalMetricsResumenNegocios(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('suscriptorId') suscriptorId?: string,
  ) {
    return this.estadisticasService.getGlobalMetricsResumenNegocios(
      this.requester(req),
      {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        suscriptorId: suscriptorId ? Number(suscriptorId) : undefined,
      },
    );
  }

  /**
   * GET /estadisticas/negocio/:id/global-metrics
   * Métricas globales de un negocio: búsquedas, vistas, clics, likes,
   * promociones activas, desglose por sucursal y tendencia mensual.
   *
   * Usado por: sección business/global-metrics/:id en la app Jelpy
   */
  // JLP-M24: dashboard de métricas de un negocio → JWT + dueño del negocio (o admin).
  @UseGuards(JwtAuthGuard)
  @Get('negocio/:id/global-metrics')
  getGlobalMetricsNegocio(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.estadisticasService.getGlobalMetricsNegocio(id, this.requester(req));
  }

  @UseGuards(JwtAuthGuard)
  @Get('sucursal/:sucursalId/desglose')
  getDesgloseSucursal(
    @Req() req: any,
    @Param('sucursalId', ParseIntPipe) sucursalId: number,
  ) {
    return this.estadisticasService.getDesgloseSucursal(sucursalId, this.requester(req));
  }

}
