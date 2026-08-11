import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EstadisticasService, RequesterCtx } from './estadisticas.service';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../../../common/guards/admin.guard';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  // JLP-M24: contexto del solicitante desde el token.
  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  // JLP-M24: tracking de eventos (vista/clic/búsqueda) es anónimo por diseño
  // (app pública + usecase de IA). Se mitiga la inyección con rate-limit, no con auth.
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post('evento')
  registrarEventoBody(@Body() body: { entidad: 'negocio' | 'sucursal', id: number, tipo: 'vista' | 'clic' | 'busqueda' }) {
    return this.estadisticasService.registrarEvento(body.tipo, body.entidad, body.id);
  }

  // Registrar evento (vista, clic, búsqueda)
  @Throttle({ default: { limit: 60, ttl: 60 } })
  @Post(':entidad/:id/:tipo')
  registrarEvento(
    @Param('entidad') entidad: 'negocio' | 'sucursal',
    @Param('id') id: number,
    @Param('tipo') tipo: 'vista' | 'clic' | 'busqueda',
  ) {
    return this.estadisticasService.registrarEvento(tipo, entidad, id);
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

}
