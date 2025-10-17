import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { VentasMembresiasService } from './ventas-membresias.service';
import { CreateVentaMembresiaDto } from './dto/create-venta-membresia.dto';

@Controller('ventas/membresias')
export class VentasMembresiasController {
  constructor(private readonly ventasService: VentasMembresiasService) {}

  @Post('registrar')
  async registrar(@Body() dto: CreateVentaMembresiaDto) {
    return this.ventasService.registrar(dto);
  }

  @Get('resumen')
  async resumen(
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('ciudadId') ciudadId?: number,
  ) {
    return this.ventasService.resumen(fechaInicio, fechaFin, ciudadId);
  }

  @Get('por-suscriptor')
  async porSuscriptor(@Query('suscriptorId') suscriptorId: number) {
    return this.ventasService.porSuscriptor(Number(suscriptorId));
  }

  @Get('por-negocio')
  async porNegocio(@Query('negocioId') negocioId: number) {
    return this.ventasService.porNegocio(Number(negocioId));
  }

  // REPORTE DE VENTAS POR CIUDAD Y MEMBRESÍA
@Get('reporte-ciudad')
async reportePorCiudad(
  @Query('fechaInicio') fechaInicio?: string,
  @Query('fechaFin') fechaFin?: string,
) {
  return this.ventasService.reportePorCiudad(fechaInicio, fechaFin);
}


// REPORTE DE VENTAS MENSUAL (CRECIMIENTO POR MES)
@Get('reporte-mensual')
async reporteMensual(
  @Query('anio') anio?: number,
  @Query('ciudadId') ciudadId?: number,
) {
  return this.ventasService.reporteMensual(anio, ciudadId);
}


// REPORTE DE VENTAS ANUAL (COMPARATIVO POR AÑO)
@Get('reporte-anual')
async reporteAnual(@Query('ciudadId') ciudadId?: number) {
  return this.ventasService.reporteAnual(ciudadId);
}


//ventas/membresias/reporte-anual-detallado


}
