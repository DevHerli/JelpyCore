import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { SuscripcionesService } from './suscripciones.service';
import { CrearSuscripcionDto } from './dtos/crear-suscripcion.dto';
import { CambiarPlanDto } from './dtos/cambiar-plan.dto';
import { ConsumirCuotaDto } from './dtos/consumir-cuota.dto';
import { UpsertMembresiaCuotasDto } from './dtos/upsert-membresia-cuotas.dto';
import { CrearEstadoCuentaMovimientoDto } from './dtos/crear-estado-cuenta-movimiento.dto';

@Controller('suscripciones')
export class SuscripcionesController {
  constructor(private readonly service: SuscripcionesService) {}

  // ── Consultas ──────────────────────────────────────────────────

  @Get('resumen/:suscriptorId')
  resumen(@Param('suscriptorId', ParseIntPipe) suscriptorId: number) {
    return this.service.obtenerResumenSuscriptor(suscriptorId);
  }

  @Get('activa/:suscriptorId')
  activa(@Param('suscriptorId', ParseIntPipe) suscriptorId: number) {
    return this.service.obtenerSuscripcionActiva(suscriptorId);
  }

  @Get('estado-cuenta/:suscriptorId')
  estadoCuenta(@Param('suscriptorId', ParseIntPipe) suscriptorId: number) {
    return this.service.obtenerEstadoCuenta(suscriptorId);
  }

  // ── Acciones ───────────────────────────────────────────────────

  @Post()
  crear(@Body() dto: CrearSuscripcionDto) {
    return this.service.crearSuscripcion(dto);
  }

  @Post('cambiar-plan')
  cambiarPlan(@Body() dto: CambiarPlanDto) {
    return this.service.cambiarPlan({
      suscriptorId: dto.suscriptorId,
      nuevaMembresiaId: dto.nuevaMembresiaId,
      fechaInicio: dto.fechaInicio,
      proximaFechaCorte: dto.proximaFechaCorte,
      renovacionAutomatica: dto.renovacionAutomatica,
      motivo: dto.motivo,
    });
  }

  @Patch(':id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.service.cancelarSuscripcion(id);
  }

  @Post('consumir')
  consumir(@Body() dto: ConsumirCuotaDto) {
    return this.service.consumirCuota({
      suscriptorId: dto.suscriptorId,
      tipo: dto.tipo,
    });
  }

  // ── Estado de cuenta ───────────────────────────────────────────

  @Post('estado-cuenta/movimiento')
  crearMovimiento(@Body() dto: CrearEstadoCuentaMovimientoDto) {
    return this.service.crearMovimientoEstadoCuenta(dto);
  }

  // ── Cuotas de membresía ────────────────────────────────────────

  @Get('cuotas')
  listarCuotas() {
    return this.service.listarCuotas();
  }

  @Get('cuotas/membresia/:membresiaId')
  obtenerCuotas(@Param('membresiaId', ParseIntPipe) membresiaId: number) {
    return this.service.obtenerCuotasPorMembresia(membresiaId);
  }

  @Post('cuotas')
  upsertCuotas(@Body() dto: UpsertMembresiaCuotasDto) {
    return this.service.upsertCuotas(dto);
  }
}