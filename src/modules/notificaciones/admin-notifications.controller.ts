import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminGuard }                from './guards/admin.guard';
import { SendNotificationDto }       from './dtos/send-notification.dto';

@UseGuards(AdminGuard)   // ← Verifica JWT + role = 'admin'. 403 si no cumple.
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly adminService: AdminNotificationsService) {}

  /**
   * Enviar notificación push.
   * POST /admin/notifications/send
   * Requiere role = 'admin'.
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  enviarNotificacion(
    @Body() dto: SendNotificationDto,
    @Request() req: any,
  ) {
    return this.adminService.enviarNotificacion(dto, req.user.sub);
  }

  /**
   * Resumen general de métricas.
   * GET /admin/notifications/stats
   * Debe ir ANTES de ":id" para no ser capturado como param.
   */
  @Get('stats')
  obtenerStats() {
    return this.adminService.obtenerStats();
  }

  /**
   * Historial de notificaciones enviadas.
   * GET /admin/notifications?page=1&per_page=20
   */
  @Get()
  listarNotificaciones(
    @Query('page')     page     = '1',
    @Query('per_page') perPage  = '20',
  ) {
    return this.adminService.listarNotificaciones(Number(page), Number(perPage));
  }

  /**
   * Detalle + estadísticas de una notificación.
   * GET /admin/notifications/:id
   */
  @Get(':id')
  obtenerDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.obtenerDetalle(id);
  }
}
