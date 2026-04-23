import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Patch,
  Delete,
} from '@nestjs/common';
import { SucursalesCaracteristicasService } from './sucursales-caracteristicas.service';
import { AssignCaracteristicaDto } from './dtos/assign-caracteristica.dto';

@Controller('sucursales-caracteristicas')
export class SucursalesCaracteristicasController {
  constructor(
    private readonly service: SucursalesCaracteristicasService,
  ) {}

  @Post(':sucursal_id')
  assign(
    @Param('sucursal_id', ParseIntPipe) sucursal_id: number,
    @Body() dto: AssignCaracteristicaDto,
  ) {
    return this.service.assignCaracteristica(sucursal_id, dto);
  }

  @Get(':sucursal_id')
  getBySucursal(
    @Param('sucursal_id', ParseIntPipe) sucursal_id: number,
  ) {
    return this.service.getBySucursal(sucursal_id);
  }

  @Get('detalle/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch('detalle/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCaracteristicaDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete('detalle/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}