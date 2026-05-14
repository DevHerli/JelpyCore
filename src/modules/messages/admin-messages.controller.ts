import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminMessagesService }  from './admin-messages.service';
import { ApiKeyGuard }           from './guards/api-key.guard';
import { SendMessageAdminDto }   from './dtos/send-message-admin.dto';
import { UpdateMessageAdminDto } from './dtos/update-message-admin.dto';
import { MessageType } from './entities/business-message.entity';

/**
 * Endpoints admin llamados exclusivamente desde Jelpy System (panel admin).
 * Autenticación por API Key: header  X-API-Key: <JELPY_INTERNAL_API_KEY>
 * No usa JWT de suscriptores — son dos sistemas independientes.
 */
@UseGuards(ApiKeyGuard)
@Controller('admin/messages')
export class AdminMessagesController {
  constructor(private readonly adminService: AdminMessagesService) {}

  /**
   * POST /admin/messages/send
   * Crea y distribuye mensajes a suscriptores según el target.
   *
   * Body:
   * {
   *   "target_type": "individual" | "segment" | "all",
   *   "target_value": "42",          // subscriber_id o ciudad_id (null si all)
   *   "type": "system",
   *   "title": "¡Novedad en Jelpy!",
   *   "preview": "Texto corto para la lista...",
   *   "body": "Cuerpo completo del mensaje...",
   *   "sender_name": "Equipo Jelpy Negocios",
   *   "cta_label": "Ver más",         // opcional
   *   "cta_route": "/tabs/dashboard", // opcional
   *   "metadata": { "key": "value" }  // opcional
   * }
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  enviarMensaje(@Body() dto: SendMessageAdminDto) {
    return this.adminService.enviarMensaje(dto);
  }

  /**
   * GET /admin/messages/stats
   * Métricas generales: totales, tasa de lectura, desglose por tipo, últimos 7 días.
   * Debe ir ANTES de /:id para no ser capturado como parámetro.
   */
  @Get('stats')
  obtenerStats() {
    return this.adminService.obtenerStats();
  }

  /**
   * GET /admin/messages?page=1&per_page=20&type=system&subscriber_id=42&unread=true
   * Lista paginada de todos los mensajes enviados (todos los suscriptores).
   *
   * Query params (todos opcionales):
   *   page          número de página (default 1)
   *   per_page      registros por página (default 20, máx 100)
   *   type          filtro por tipo (all | payment | report | system | promotion | insight)
   *   subscriber_id filtrar mensajes de un suscriptor específico
   *   unread        'true' para mostrar solo no leídos
   */
  @Get()
  listarMensajes(
    @Query('page')          page          = '1',
    @Query('per_page')      perPage       = '20',
    @Query('type')          type          = 'all',
    @Query('subscriber_id') subscriberId?: string,
    @Query('unread')        unread?:       string,
  ) {
    return this.adminService.listarMensajes({
      page:          Math.max(1, Number(page)),
      perPage:       Math.min(100, Math.max(1, Number(perPage))),
      type:          type as MessageType | 'all',
      subscriberId:  subscriberId ? Number(subscriberId) : undefined,
      onlyUnread:    unread === 'true',
    });
  }

  /**
   * GET /admin/messages/:id
   * Detalle completo de un mensaje (body incluido).
   */
  @Get(':id')
  obtenerDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.obtenerDetalle(id);
  }

  /**
   * PATCH /admin/messages/:id
   * Edita los campos de contenido de un mensaje ya enviado.
   * Solo actualiza los campos que se incluyan en el body (PATCH parcial).
   *
   * Body (todos opcionales):
   * {
   *   "type":        "system",
   *   "title":       "Nuevo título",
   *   "preview":     "Nuevo resumen corto",
   *   "body":        "Nuevo cuerpo...",
   *   "sender_name": "Equipo Jelpy",
   *   "cta_label":   "Ver más",
   *   "cta_route":   "/tabs/dashboard",
   *   "metadata":    { "key": "value" }
   * }
   */
  @Patch(':id')
  editarMensaje(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMessageAdminDto,
  ) {
    return this.adminService.editarMensaje(id, dto);
  }

  /**
   * DELETE /admin/messages/:id
   * Elimina un mensaje permanentemente.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  eliminarMensaje(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.eliminarMensaje(id);
  }
}
