import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
   * Registrar token FCM / OneSignal al iniciar sesión.
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
   * Eliminar token al cerrar sesión.
   * DELETE /notifications/token
   */
  @Delete('token')
  eliminarToken(
    @Body('token') token: string,
    @Request() req: any,
  ) {
    return this.notificationsService.eliminarToken(token, req.user.sub);
  }

  /**
   * Badge de no leídas.
   * GET /notifications/unread-count
   * Response: { "count": N }
   * Debe ir ANTES de ":id" para no ser capturado como parámetro.
   */
  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(req.user.sub);
  }

  /**
   * Marcar todas como leídas.
   * POST /notifications/read-all   ← método que usa la app
   * PATCH /notifications/read-all  ← alias por compatibilidad
   * Response: { "ok": true, "updated": N }
   * Debe ir ANTES de ":id/read".
   */
  @Post('read-all')
  @HttpCode(200)
  marcarTodasLeidasPost(@Request() req: any) {
    return this.notificationsService.marcarTodasLeidas(req.user.sub);
  }

  @Patch('read-all')
  marcarTodasLeidasPatch(@Request() req: any) {
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
   * POST /notifications/:id/read   ← método que usa la app
   * PATCH /notifications/:id/read  ← alias por compatibilidad
   * Response: { "ok": true }
   */
  @Post(':id/read')
  @HttpCode(200)
  marcarLeidaPost(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.notificationsService.marcarLeida(id, req.user.sub);
  }

  @Patch(':id/read')
  marcarLeidaPatch(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    return this.notificationsService.marcarLeida(id, req.user.sub);
  }
}
