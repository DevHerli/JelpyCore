import {
  Controller,
  ForbiddenException,
  Post,
  Body,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * JLP-C12 — Verifica que el usuario autenticado sea el dueño del recurso
   * solicitado (o un administrador).
   */
  private assertOwner(req: any, suscriptorId: number): void {
    const sub     = Number(req.user?.sub);
    const isAdmin = req.user?.role === 'admin';
    if (!sub || (sub !== suscriptorId && !isAdmin)) {
      throw new ForbiddenException('Solo puedes acceder a tus propios favoritos.');
    }
  }

  // ─── Endpoints ───────────────────────────────────────────────────────────

  /**
   * JLP-M22: la identidad (suscriptorId) se deriva del token, NO del body,
   * para impedir suplantación de favoritos / marcado de lecturas ajenas.
   */
  @UseGuards(JwtAuthGuard)
  @Post('toggle')
  toggle(
    @Req() req: any,
    @Body('sucursalId') sucursalId: number,
  ) {
    const suscriptorId = Number(req.user?.sub);
    return this.bookmarksService.toggle(Number(sucursalId), suscriptorId);
  }

  /**
   * JLP-C12 — Requiere JWT + ownership: solo el propio usuario (o admin)
   * puede listar sus favoritos. Antes era un endpoint público sin guard.
   */
  @UseGuards(JwtAuthGuard)
  @Get('user/:suscriptorId')
  findByUser(@Param('suscriptorId') suscriptorId: number, @Req() req: any) {
    this.assertOwner(req, Number(suscriptorId));
    return this.bookmarksService.findByUser(Number(suscriptorId));
  }

  /**
   * JLP-C12 — Requiere JWT + ownership: consulta si el propio usuario guardó
   * una sucursal. Antes era público, exponiendo el historial de interés.
   */
  @UseGuards(JwtAuthGuard)
  @Get('check/:sucursalId/:suscriptorId')
  check(
    @Param('sucursalId') sucursalId: number,
    @Param('suscriptorId') suscriptorId: number,
    @Req() req: any,
  ) {
    this.assertOwner(req, Number(suscriptorId));
    return this.bookmarksService.isBookmarked(
      Number(sucursalId),
      Number(suscriptorId),
    );
  }

  /**
   * JLP-C12 — Requiere JWT + ownership: resumen de novedades no leídas de
   * favoritos. Antes público — exponía actividad reciente del usuario.
   */
  @UseGuards(JwtAuthGuard)
  @Get('suscriptor/:suscriptorId/resumen-no-leidos')
  obtenerResumenNoLeidosFavoritos(
    @Param('suscriptorId') suscriptorId: number,
    @Req() req: any,
  ) {
    this.assertOwner(req, Number(suscriptorId));
    return this.bookmarksService.obtenerResumenNoLeidosFavoritos(
      Number(suscriptorId),
    );
  }

  /**
   * JLP-C12 — Requiere JWT + ownership: lista de favoritos con novedades.
   * Antes público — exponía qué negocios sigue el usuario.
   */
  @UseGuards(JwtAuthGuard)
  @Get('suscriptor/:suscriptorId/con-novedades')
  obtenerFavoritosConNovedades(
    @Param('suscriptorId') suscriptorId: number,
    @Req() req: any,
  ) {
    this.assertOwner(req, Number(suscriptorId));
    return this.bookmarksService.obtenerFavoritosConNovedades(
      Number(suscriptorId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('marcar-eventos-leidos')
  marcarEventosFavoritoComoLeidos(
    @Req() req: any,
    @Body('negocioId') negocioId: number,
    @Body('sucursalId') sucursalId?: number,
  ) {
    const suscriptorId = Number(req.user?.sub);
    return this.bookmarksService.marcarEventosFavoritoComoLeidos(
      suscriptorId,
      Number(negocioId),
      sucursalId !== undefined && sucursalId !== null
        ? Number(sucursalId)
        : undefined,
    );
  }
}