import { Controller, Get, Post, Body, Param, Patch, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { SucursalReviewService, RequesterCtx } from './sucursal-review.service';
import { CreateSucursalReviewDto } from './dtos/create-sucursal-review.dto';
import { UpdateSucursalReviewDto } from './dtos/update-sucursal-review.dto';

// JLP-H20 — Autoría desde token; respuesta = dueño del negocio; estado = admin.
@Controller('sucursales-reviews')
export class SucursalReviewController {
  constructor(private readonly service: SucursalReviewService) {}

  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateSucursalReviewDto, @Req() req: any) {
    // La autoría se toma del token, ignorando cualquier suscriptorId del body.
    return this.service.create(dto, Number(req.user?.sub));
  }

  @Get('sucursal/:id')
  findBySucursal(@Param('id') id: number) {
    return this.service.findBySucursal(+id);
  }

  @Get('sucursal/:id/summary')
  summary(@Param('id') id: number) {
    return this.service.getRatingSummary(+id);
  }

  @Get('negocio/:id')
  findByNegocio(@Param('id', ParseIntPipe) id: number) {
  return this.service.findByNegocio(id);
  }

@Patch(':id')
@UseGuards(JwtAuthGuard)
update(
  @Param('id') id: number,
  @Body() body: { data: UpdateSucursalReviewDto },
  @Req() req: any,
) {
  // La propiedad de la reseña se valida contra el suscriptor del token.
  return this.service.update(id, Number(req.user?.sub), body.data);
}

// Moderación de estado: solo administradores.
@Patch(':id/estado')
@UseGuards(AdminGuard)
updateEstado(
  @Param('id') id: number,
  @Body() body: { estado: 'pendiente' | 'publicada' | 'rechazada' },
) {
  return this.service.updateEstado(id, body.estado);
}

// Responder reseña: solo el dueño del negocio (o admin).
@Patch(':id/respuesta')
@UseGuards(JwtAuthGuard)
responder(
  @Param('id', ParseIntPipe) id: number,
  @Body('respuesta') respuesta: string,
  @Req() req: any,
) {
  return this.service.responderReview(id, respuesta, this.requester(req));
}


}
