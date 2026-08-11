import { Controller, Post, Body, Get, Param, Req, UseGuards } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

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

  @Get('user/:suscriptorId')
  findByUser(@Param('suscriptorId') suscriptorId: number) {
    return this.bookmarksService.findByUser(Number(suscriptorId));
  }

  @Get('check/:sucursalId/:suscriptorId')
  check(
    @Param('sucursalId') sucursalId: number,
    @Param('suscriptorId') suscriptorId: number,
  ) {
    return this.bookmarksService.isBookmarked(
      Number(sucursalId),
      Number(suscriptorId),
    );
  }

  @Get('suscriptor/:suscriptorId/resumen-no-leidos')
  obtenerResumenNoLeidosFavoritos(
    @Param('suscriptorId') suscriptorId: number,
  ) {
    return this.bookmarksService.obtenerResumenNoLeidosFavoritos(
      Number(suscriptorId),
    );
  }

  @Get('suscriptor/:suscriptorId/con-novedades')
  obtenerFavoritosConNovedades(
    @Param('suscriptorId') suscriptorId: number,
  ) {
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