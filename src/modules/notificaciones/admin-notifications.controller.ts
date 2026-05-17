import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminNotificationsService } from './admin-notifications.service';
import { ApiKeyGuard }               from '../messages/guards/api-key.guard';
import { SendNotificationDto }       from './dtos/send-notification.dto';

/**
 * Endpoints admin de notificaciones — llamados exclusivamente desde Jelpy System.
 * Autenticación por API Key: header  X-API-Key: <JELPY_INTERNAL_API_KEY>
 * Mismo mecanismo que /admin/messages/*.
 */
@UseGuards(ApiKeyGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly adminService: AdminNotificationsService) {}

  /**
   * Enviar notificación push.
   * POST /admin/notifications/send
   *
   * sent_by usa el ID de sistema (0) ya que la request viene de Jelpy System,
   * no de un suscriptor individual.
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  enviarNotificacion(@Body() dto: SendNotificationDto) {
    // ID 0 = "Jelpy System" — no es un suscriptor real,
    // pero evita el JOIN roto con suscriptores
    return this.adminService.enviarNotificacion(dto, 0);
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

  /**
   * Eliminar una notificación del historial.
   * DELETE /admin/notifications/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.eliminarNotificacion(id);
  }
}
