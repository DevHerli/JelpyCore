import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post('toggle')
  toggle(
    @Body('sucursalId') sucursalId: number,
    @Body('suscriptorId') suscriptorId: number,
  ) {
    return this.bookmarksService.toggle(Number(sucursalId), Number(suscriptorId));
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

  @Post('marcar-eventos-leidos')
  marcarEventosFavoritoComoLeidos(
    @Body('suscriptorId') suscriptorId: number,
    @Body('negocioId') negocioId: number,
    @Body('sucursalId') sucursalId?: number,
  ) {
    return this.bookmarksService.marcarEventosFavoritoComoLeidos(
      Number(suscriptorId),
      Number(negocioId),
      sucursalId !== undefined && sucursalId !== null
        ? Number(sucursalId)
        : undefined,
    );
  }
}