import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { EstadisticasSucursalesHistoricoService } from './estadisticas-sucursales-historico.service';
import { CreateEstadisticaSucursalDto } from './dto/create-estadistica-sucursal.dto';

@Controller('estadisticas/sucursales')
export class EstadisticasSucursalesHistoricoController {
  constructor(private readonly estService: EstadisticasSucursalesHistoricoService) {}

  @Post('registrar')
  async registrar(@Body() dto: CreateEstadisticaSucursalDto) {
    return this.estService.registrar(dto);
  }

  @Get('por-sucursal')
  async porSucursal(@Query('sucursalId') sucursalId: number) {
    return this.estService.obtenerPorSucursal(Number(sucursalId));
  }

  @Get('por-negocio')
  async porNegocio(
    @Query('negocioId') negocioId: number,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.estService.obtenerPorNegocio(Number(negocioId), fechaInicio, fechaFin);
  }

  @Get('totales-ciudad')
  async totalesCiudad(@Query('ciudadId') ciudadId: number) {
    return this.estService.obtenerTotalesPorCiudad(Number(ciudadId));
  }


// 🏆 TOP SUCURSALES
@Get('top')
async topSucursales(
  @Query('negocioId') negocioId?: number,
  @Query('ciudadId') ciudadId?: number,
  @Query('fechaInicio') fechaInicio?: string,
  @Query('fechaFin') fechaFin?: string,
  @Query('tipo') tipo: 'vistas' | 'clics' = 'vistas',
  @Query('limite') limite = 5,
) {
  return this.estService.obtenerTopSucursales({
    negocioId: negocioId ? Number(negocioId) : undefined,
    ciudadId: ciudadId ? Number(ciudadId) : undefined,
    fechaInicio,
    fechaFin,
    tipo,
    limite: Number(limite),
  });
}


}
