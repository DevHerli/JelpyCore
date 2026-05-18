import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Post('evento')
  registrarEventoBody(@Body() body: { entidad: 'negocio' | 'sucursal', id: number, tipo: 'vista' | 'clic' | 'busqueda' }) {
    return this.estadisticasService.registrarEvento(body.tipo, body.entidad, body.id);
  }

  // Registrar evento (vista, clic, búsqueda)
  @Post(':entidad/:id/:tipo')
  registrarEvento(
    @Param('entidad') entidad: 'negocio' | 'sucursal',
    @Param('id') id: number,
    @Param('tipo') tipo: 'vista' | 'clic' | 'busqueda',
  ) {
    return this.estadisticasService.registrarEvento(tipo, entidad, id);
  }

  // Resumen de negocios
  @Get('negocios')
  resumenNegocios() {
    return this.estadisticasService.resumenNegocios();
  }

  // Resumen de sucursales
  @Get('sucursales')
  resumenSucursales() {
    return this.estadisticasService.resumenSucursales();
  }

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
  @Get('negocio/:id/global-metrics')
  getGlobalMetricsNegocio(@Param('id', ParseIntPipe) id: number) {
    return this.estadisticasService.getGlobalMetricsNegocio(id);
  }

}
