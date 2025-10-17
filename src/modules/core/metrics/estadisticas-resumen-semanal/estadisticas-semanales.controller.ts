import { Controller, Get, Query } from '@nestjs/common';
import { EstadisticasSemanalesService } from './estadisticas-semanales.service';

@Controller('estadisticas/semanales')
export class EstadisticasSemanalesController {
  constructor(private readonly estadisticasService: EstadisticasSemanalesService) {}

  // GET /estadisticas/semanales/resumen
  @Get('resumen')
  async obtenerResumen(
    @Query('ciudadId') ciudadId?: number,
    @Query('membresiaId') membresiaId?: number,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.estadisticasService.obtenerResumen({
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      membresiaId: membresiaId ? Number(membresiaId) : undefined,
      fechaInicio,
      fechaFin,
    });
  }

  // GET /estadisticas/semanales/ultimas
  @Get('ultimas')
  async ultimas(@Query('limite') limite = 5) {
    return this.estadisticasService.obtenerUltimasSemanas(Number(limite));
  }


  //Top negocios (más vistas o clics)
  @Get('top')
  async top(
    @Query('ciudadId') ciudadId?: number,
    @Query('membresiaId') membresiaId?: number,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('tipo') tipo: 'vistas' | 'clics' = 'vistas',
    @Query('limite') limite = 5,
  ) {
    return this.estadisticasService.obtenerTopNegocios({
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      membresiaId: membresiaId ? Number(membresiaId) : undefined,
      fechaInicio,
      fechaFin,
      tipo,
      limite: Number(limite),
    });
  }


@Get('top-sucursales')
async topSucursales(
  @Query('negocioId') negocioId?: number,
  @Query('ciudadId') ciudadId?: number,
  @Query('fechaInicio') fechaInicio?: string,
  @Query('fechaFin') fechaFin?: string,
  @Query('tipo') tipo: 'vistas' | 'clics' = 'vistas',
  @Query('limite') limite = 5,
) {
  return this.estadisticasService.obtenerTopSucursales({
    negocioId: negocioId ? Number(negocioId) : undefined,
    ciudadId: ciudadId ? Number(ciudadId) : undefined,
    fechaInicio,
    fechaFin,
    tipo,
    limite: Number(limite),
  });
}



}
