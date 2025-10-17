import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { NegociosService } from './negocios.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

@Controller('negocios')
export class NegociosController {
  constructor(private readonly negociosService: NegociosService) {}

  @Get()
  listar() {
    return this.negociosService.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.obtenerPorId(id);
  }

  @Get('suscriptor/:id')
  listarPorSuscriptor(@Param('id', ParseIntPipe) suscriptorId: number) {
  return this.negociosService.listarPorSuscriptor(suscriptorId);
}

  // Obtener detalle completo de un negocio
  @Get(':id/detalle')
  async obtenerDetalle(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.obtenerDetalle(id);
  }


  @Post()
  crear(@Body() dto: CreateNegocioDto) {
    return this.negociosService.crear(dto);
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNegocioDto,
  ) {
    return this.negociosService.actualizar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.negociosService.eliminar(id);
  }
}
