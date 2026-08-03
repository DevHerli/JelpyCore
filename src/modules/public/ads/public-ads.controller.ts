import { BadRequestException, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AnunciosService } from '../../business/anuncios/anuncios.service';

/**
 * GET  /public/ads          — feed público de anuncios por placement
 * GET  /public/ads/placements-permitidos/:negocioId
 * POST /public/ads/:id/impression
 * POST /public/ads/:id/click
 */
@Controller('public/ads')
export class PublicAdsController {
  constructor(private readonly anunciosService: AnunciosService) {}

  /** Feed público — consumido por el home y vistas de categoría */
  @Get()
  getPublicAds(
    @Query('placement') placement: string,
    @Query('ciudadId') ciudadId?: string,
    @Query('categoria') categoria?: string,
    @Query('limit') limit?: string,
  ) {
    if (!placement) throw new BadRequestException('placement es requerido');
    return this.anunciosService.getPublicAds({
      placement,
      ciudadId : ciudadId ? Number(ciudadId) : undefined,
      categoria,
      limit    : limit ? Number(limit) : undefined,
    });
  }

  /** Placements que puede usar un negocio según su membresía */
  @Get('placements-permitidos/:negocioId')
  getPlacementsPermitidos(@Param('negocioId', ParseIntPipe) negocioId: number) {
    return this.anunciosService.getPlacementsPermitidos(negocioId);
  }

  /** Registrar impresión */
  @Post(':id/impression')
  impression(@Param('id', ParseIntPipe) id: number) {
    return this.anunciosService.impression(id);
  }

  /** Registrar clic */
  @Post(':id/click')
  click(@Param('id', ParseIntPipe) id: number) {
    return this.anunciosService.click(id);
  }
}
