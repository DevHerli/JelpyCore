import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { SuscripcionesService } from './suscripciones.service';
import { CrearSuscripcionDto } from './dtos/crear-suscripcion.dto';
import { ConsumirCuotaDto } from './dtos/consumir-cuota.dto';
import { CrearEstadoCuentaMovimientoDto } from './dtos/crear-estado-cuenta-movimiento.dto';

@Controller('suscripciones')
export class SuscripcionesController {
  constructor(private readonly service: SuscripcionesService) {}

  @Get('resumen/:suscriptorId')
  async resumen(@Param('suscriptorId', ParseIntPipe) suscriptorId: number) {
    return this.service.obtenerResumenSuscriptor(suscriptorId);
  }

  @Get('activa/:suscriptorId')
  async activa(@Param('suscriptorId', ParseIntPipe) suscriptorId: number) {
    return this.service.obtenerSuscripcionActiva(suscriptorId);
  }

  @Get('estado-cuenta/:suscriptorId')
  async estadoCuenta(
    @Param('suscriptorId', ParseIntPipe) suscriptorId: number,
  ) {
    return this.service.obtenerEstadoCuenta(suscriptorId);
  }

  @Post()
  async crear(@Body() dto: CrearSuscripcionDto) {
    return this.service.crearSuscripcion(dto);
  }

  @Post('consumir')
  consumir(@Body() dto: ConsumirCuotaDto) {
    return this.service.consumirCuota({
      suscriptorId: dto.suscriptorId,
      tipo: dto.tipo,
    });
  }

  @Post('estado-cuenta/movimiento')
    async crearMovimiento(@Body() dto: CrearEstadoCuentaMovimientoDto) {
    return this.service.crearMovimientoEstadoCuenta(dto);
}
}