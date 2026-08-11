import { Controller, Post, Body, Get, Query, Req, UseGuards } from '@nestjs/common';
import { EstadisticasSucursalesHistoricoService, RequesterCtx } from './estadisticas-sucursales-historico.service';
import { CreateEstadisticaSucursalDto } from './dto/create-estadistica-sucursal.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../../../common/guards/admin.guard';

@Controller('estadisticas/sucursales')
export class EstadisticasSucursalesHistoricoController {
  constructor(private readonly estService: EstadisticasSucursalesHistoricoService) {}

  // JLP-M24: contexto del solicitante desde el token.
  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  // JLP-M24: escritura de históricos sin llamador legítimo (cron escribe por SQL) → solo admin.
  @UseGuards(AdminGuard)
  @Post('registrar')
  async registrar(@Body() dto: CreateEstadisticaSucursalDto) {
    return this.estService.registrar(dto);
  }

  // JLP-M24: métricas por sucursal → JWT + dueño de la sucursal (o admin).
  @UseGuards(JwtAuthGuard)
  @Get('por-sucursal')
  async porSucursal(@Req() req: any, @Query('sucursalId') sucursalId: number) {
    return this.estService.obtenerPorSucursal(Number(sucursalId), this.requester(req));
  }

  // JLP-M24: métricas por negocio → JWT + dueño del negocio (o admin).
  @UseGuards(JwtAuthGuard)
  @Get('por-negocio')
  async porNegocio(
    @Req() req: any,
    @Query('negocioId') negocioId: number,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
  ) {
    return this.estService.obtenerPorNegocio(Number(negocioId), fechaInicio, fechaFin, this.requester(req));
  }

  // JLP-M24: totales por ciudad (BI de plataforma) → solo admin.
  @UseGuards(AdminGuard)
  @Get('totales-ciudad')
  async totalesCiudad(@Query('ciudadId') ciudadId: number) {
    return this.estService.obtenerTotalesPorCiudad(Number(ciudadId));
  }


// TOP SUCURSALES
// JLP-M24: ranking de plataforma → solo admin.
@UseGuards(AdminGuard)
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
