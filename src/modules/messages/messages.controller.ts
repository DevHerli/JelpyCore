import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesJwtAuthGuard } from './guards/jwt-auth.guard';
import { QueryMessagesDto } from './dtos/query-messages.dto';

/**
 * Prefijo: /messages  (el frontend usa /api/messages → ajusta el baseURL del HttpClient)
 *
 * IMPORTANTE: las rutas estáticas (read-all, unread-count) van ANTES de /:id
 * para evitar que NestJS las capture como parámetros.
 */
@UseGuards(MessagesJwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * GET /messages/unread-count
   * Badge del ícono de mensajes.
   * { total: 4, by_type: { payment: 2, system: 1, insight: 1 } }
   */
  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.messagesService.getUnreadCount(Number(req.user.sub));
  }

  /**
   * PATCH /messages/read-all
   * Marca todos los mensajes del suscriptor autenticado como leídos.
   * { ok: true, updated: 4 }
   */
  @Patch('read-all')
  markAllAsRead(@Request() req: any) {
    return this.messagesService.markAllAsRead(Number(req.user.sub));
  }

  /**
   * GET /messages?page=1&per_page=30&type=all
   * Lista paginada de mensajes del negocio autenticado.
   */
  @Get()
  getAll(@Query() query: QueryMessagesDto, @Request() req: any) {
    return this.messagesService.getAll(Number(req.user.sub), query);
  }

  /**
   * GET /messages/:id
   * Detalle de un mensaje. 403 si no pertenece al suscriptor autenticado.
   */
  @Get(':id')
  getById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.messagesService.getById(id, Number(req.user.sub));
  }

  /**
   * PATCH /messages/:id/read
   * Marca un mensaje como leído. { ok: true }
   */
  @Patch(':id/read')
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.messagesService.markAsRead(id, Number(req.user.sub));
  }
}
