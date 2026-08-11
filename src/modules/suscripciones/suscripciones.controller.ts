/**
 * SuscripcionesController
 *
 * Modelo de autorización (JLP — corrección de autorización rota):
 *  - Endpoints por-suscriptor (consulta/acciones del propio usuario) → JwtAuthGuard + propiedad.
 *  - Endpoints de back-office / financieros → AdminGuard (role='admin' verificado en BD).
 *
 * IMPORTANTE: el flujo de pago (PagosService) invoca los MÉTODOS del servicio
 * directamente (server-to-server), NO estos endpoints HTTP. Por eso proteger las
 * rutas con AdminGuard no rompe el pago: crear/renovar suscripción tras un pago
 * confirmado ocurre vía SuscripcionesService.renovarOCrearSuscripcion().
 *
 * ⚠️ Confirmar con el equipo: si la app móvil llama directamente a POST /suscripciones
 *    o POST /suscripciones/cambiar-plan, ese flujo debe migrar a pasar por Pagos.
 */
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { SuscripcionesService } from './suscripciones.service';
import { CrearSuscripcionDto } from './dtos/crear-suscripcion.dto';
import { CambiarPlanDto } from './dtos/cambiar-plan.dto';
import { ConsumirCuotaDto } from './dtos/consumir-cuota.dto';
import { UpsertMembresiaCuotasDto } from './dtos/upsert-membresia-cuotas.dto';
import { CrearEstadoCuentaMovimientoDto } from './dtos/crear-estado-cuenta-movimiento.dto';

@Controller('suscripciones')
export class SuscripcionesController {
  constructor(private readonly service: SuscripcionesService) {}

  /**
   * Verifica que el sub del JWT coincida con el suscriptorId objetivo.
   * Los administradores (role='admin' en el claim) siempre pasan.
   */
  private assertOwnership(req: any, targetSuscriptorId: number): void {
    const sub = Number(req.user?.sub);
    const isAdmin = req.user?.role === 'admin';
    if (!sub || (sub !== Number(targetSuscriptorId) && !isAdmin)) {
      throw new ForbiddenException('Solo puedes gestionar tu propia suscripción.');
    }
  }

  // ── Consultas (propio usuario o admin) ─────────────────────────

  @Get('resumen/:suscriptorId')
  @UseGuards(JwtAuthGuard)
  resumen(
    @Param('suscriptorId', ParseIntPipe) suscriptorId: number,
    @Request() req: any,
  ) {
    this.assertOwnership(req, suscriptorId);
    return this.service.obtenerResumenSuscriptor(suscriptorId);
  }

  @Get('activa/:suscriptorId')
  @UseGuards(JwtAuthGuard)
  activa(
    @Param('suscriptorId', ParseIntPipe) suscriptorId: number,
    @Request() req: any,
  ) {
    this.assertOwnership(req, suscriptorId);
    return this.service.obtenerSuscripcionActiva(suscriptorId);
  }

  @Get('estado-cuenta/:suscriptorId')
  @UseGuards(JwtAuthGuard)
  estadoCuenta(
    @Param('suscriptorId', ParseIntPipe) suscriptorId: number,
    @Request() req: any,
  ) {
    this.assertOwnership(req, suscriptorId);
    return this.service.obtenerEstadoCuenta(suscriptorId);
  }

  // ── Acciones administrativas (crean/mutan suscripciones sin pago) ──

  /**
   * POST /suscripciones — creación manual (back-office).
   * El alta tras pago confirmado ocurre en PagosService, no aquí.
   */
  @Post()
  @UseGuards(AdminGuard)
  crear(@Body() dto: CrearSuscripcionDto) {
    return this.service.crearSuscripcion(dto);
  }

  /**
   * POST /suscripciones/cambiar-plan — cambio de plan (back-office).
   * Un cambio de plan de usuario debe pasar por el flujo de pago.
   */
  @Post('cambiar-plan')
  @UseGuards(AdminGuard)
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

  /**
   * PATCH /suscripciones/:id/cancelar — el usuario cancela SU propia suscripción.
   * La propiedad se verifica en el servicio (carga la relación suscriptor).
   */
  @Patch(':id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancelar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.cancelarSuscripcion(id, {
      sub: Number(req.user?.sub),
      isAdmin: req.user?.role === 'admin',
    });
  }

  /**
   * POST /suscripciones/consumir — consume cuota del propio suscriptor.
   */
  @Post('consumir')
  @UseGuards(JwtAuthGuard)
  consumir(@Body() dto: ConsumirCuotaDto, @Request() req: any) {
    this.assertOwnership(req, dto.suscriptorId);
    return this.service.consumirCuota({
      suscriptorId: dto.suscriptorId,
      tipo: dto.tipo,
    });
  }

  // ── Estado de cuenta (primitivo financiero — solo admin/interno) ──

  /**
   * POST /suscripciones/estado-cuenta/movimiento
   * JLP-CRÍTICO: crear abonos/cargos altera el saldo. Solo admin.
   * El registro de abonos tras un pago ocurre vía PagosService (interno).
   */
  @Post('estado-cuenta/movimiento')
  @UseGuards(AdminGuard)
  crearMovimiento(@Body() dto: CrearEstadoCuentaMovimientoDto) {
    return this.service.crearMovimientoEstadoCuenta(dto);
  }

  // ── Cuotas de membresía ────────────────────────────────────────
  // Lectura del catálogo de cuotas por tier (información no sensible por-usuario).

  @Get('cuotas')
  listarCuotas() {
    return this.service.listarCuotas();
  }

  @Get('cuotas/membresia/:membresiaId')
  obtenerCuotas(@Param('membresiaId', ParseIntPipe) membresiaId: number) {
    return this.service.obtenerCuotasPorMembresia(membresiaId);
  }

  /**
   * POST /suscripciones/cuotas — reescribe la configuración global de cuotas
   * de una membresía. Solo admin.
   */
  @Post('cuotas')
  @UseGuards(AdminGuard)
  upsertCuotas(@Body() dto: UpsertMembresiaCuotasDto) {
    return this.service.upsertCuotas(dto);
  }

  // ── Renovación automática (propio usuario o admin) ─────────────

  /** PATCH /suscripciones/renovacion/:suscriptorId */
  @Patch('renovacion/:suscriptorId')
  @UseGuards(JwtAuthGuard)
  setAutoRenew(
    @Param('suscriptorId', ParseIntPipe) suscriptorId: number,
    @Body() body: { autoRenew: boolean },
    @Request() req: any,
  ) {
    this.assertOwnership(req, suscriptorId);
    if (body?.autoRenew === undefined)
      throw new BadRequestException('autoRenew requerido (boolean)');
    return this.service.setAutoRenew(suscriptorId, !!body.autoRenew);
  }
}
