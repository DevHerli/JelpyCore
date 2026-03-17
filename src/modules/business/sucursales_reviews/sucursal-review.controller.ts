import { Controller, Get, Post, Body, Param, Patch, ParseIntPipe } from '@nestjs/common';
import { SucursalReviewService } from './sucursal-review.service';
import { CreateSucursalReviewDto } from './dtos/create-sucursal-review.dto';
import { UpdateSucursalReviewDto } from './dtos/update-sucursal-review.dto';

@Controller('sucursales-reviews')
export class SucursalReviewController {
  constructor(private readonly service: SucursalReviewService) {}

  @Post()
  create(@Body() dto: CreateSucursalReviewDto) {
    return this.service.create(dto);
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
update(
  @Param('id') id: number,
  @Body()
  body: {
    suscriptorId: number;
    data: UpdateSucursalReviewDto;
  },
) {
  return this.service.update(id, body.suscriptorId, body.data);
}

@Patch(':id/estado')
updateEstado(
  @Param('id') id: number,
  @Body() body: { estado: 'pendiente' | 'publicada' | 'rechazada' },
) {
  return this.service.updateEstado(id, body.estado);
}

@Patch(':id/respuesta')
responder(
  @Param('id', ParseIntPipe) id: number,
  @Body('respuesta') respuesta: string,
) {
  return this.service.responderReview(id, respuesta);
}


}
