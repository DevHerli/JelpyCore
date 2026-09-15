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
import { PromocionesFavoritosService } from './promociones-favoritos.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

/**
 * Favoritos de PROMOCIÓN (distinto de /bookmarks, que guarda sucursales).
 * Mismo patrón de guard + ownership que BookmarksController.
 */
@Controller('promociones-favoritos')
export class PromocionesFavoritosController {
  constructor(
    private readonly favoritosService: PromocionesFavoritosService,
  ) {}

  private assertOwner(req: any, suscriptorId: number): void {
    const sub = Number(req.user?.sub);
    const isAdmin = req.user?.role === 'admin';
    if (!sub || (sub !== suscriptorId && !isAdmin)) {
      throw new ForbiddenException('Solo puedes acceder a tus propios favoritos.');
    }
  }

  /** La identidad (suscriptorId) se deriva del token, no del body. */
  @UseGuards(JwtAuthGuard)
  @Post('toggle')
  toggle(@Req() req: any, @Body('promocionId') promocionId: number) {
    const suscriptorId = Number(req.user?.sub);
    return this.favoritosService.toggle(Number(promocionId), suscriptorId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:suscriptorId')
  findByUser(@Param('suscriptorId') suscriptorId: number, @Req() req: any) {
    this.assertOwner(req, Number(suscriptorId));
    return this.favoritosService.findByUser(Number(suscriptorId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('ids/:suscriptorId')
  findIdsByUser(@Param('suscriptorId') suscriptorId: number, @Req() req: any) {
    this.assertOwner(req, Number(suscriptorId));
    return this.favoritosService.findPromocionIdsByUser(Number(suscriptorId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('check/:promocionId/:suscriptorId')
  check(
    @Param('promocionId') promocionId: number,
    @Param('suscriptorId') suscriptorId: number,
    @Req() req: any,
  ) {
    this.assertOwner(req, Number(suscriptorId));
    return this.favoritosService.isBookmarked(
      Number(promocionId),
      Number(suscriptorId),
    );
  }
}
