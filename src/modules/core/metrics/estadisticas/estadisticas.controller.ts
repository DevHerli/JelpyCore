import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  // 🔹 Registrar evento (vista, clic, búsqueda)
  @Post(':entidad/:id/:tipo')
  registrarEvento(
    @Param('entidad') entidad: 'negocio' | 'sucursal',
    @Param('id') id: number,
    @Param('tipo') tipo: 'vista' | 'clic' | 'busqueda',
  ) {
    return this.estadisticasService.registrarEvento(tipo, entidad, id);
  }

  // 🔹 Resumen de negocios
  @Get('negocios')
  resumenNegocios() {
    return this.estadisticasService.resumenNegocios();
  }

  // 🔹 Resumen de sucursales
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



}
