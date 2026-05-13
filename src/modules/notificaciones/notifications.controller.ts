import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard }         from './guards/jwt-auth.guard';
import { RegisterTokenDto }     from './dtos/register-token.dto';
import { GetNotificationsDto }  from './dtos/get-notifications.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Registrar token FCM al iniciar sesión.
   * POST /notifications/token
   */
  @Post('token')
  registrarToken(
    @Body() dto: RegisterTokenDto,
    @Request() req: any,
  ) {
    return this.notificationsService.registrarToken(dto, req.user.sub);
  }

  /**
   * Eliminar token FCM al cerrar sesión.
   * DELETE /notifications/token
   * Body: { "token": "fcm_token_xxx" }
   */
  @Delete('token')
  eliminarToken(
    @Body('token') token: string,
    @Request() req: any,
  ) {
    return this.notificationsService.eliminarToken(token, req.user.sub);
  }

  /**
   * Conteo de notificaciones no leídas (badge de la campanita).
   * GET /notifications/unread-count
   * Debe ir ANTES de ":id" para no ser capturado como parámetro.
   */
  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  /**
   * Marcar todas como leídas.
   * PATCH /notifications/read-all
   * Debe ir ANTES de ":id/read".
   */
  @Patch('read-all')
  marcarTodasLeidas(@Request() req: any) {
    return this.notificationsService.marcarTodasLeidas(req.user.sub);
  }

  /**
   * Bandeja de notificaciones con paginación.
   * GET /notifications?page=1&per_page=20&category=traffic&unread_only=true
   */
  @Get()
  getBandeja(
    @Query() query: GetNotificationsDto,
    @Request() req: any,
  ) {
    return this.notificationsService.getBandeja(req.user.sub, {
      page:       query.page      ? Number(query.page)     : 1,
      perPage:    query.per_page  ? Number(query.per_page) : 20,
      category:   query.category,
      unreadOnly: query.unread_only === 'true',
    });
  }

  /**
   * Marcar una notificación como leída.
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  marcarLeida(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.notificationsService.marcarLeida(id, req.user.sub);
  }
}
