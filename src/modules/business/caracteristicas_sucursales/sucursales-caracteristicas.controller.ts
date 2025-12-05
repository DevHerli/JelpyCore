import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { SucursalesCaracteristicasService } from './sucursales-caracteristicas.service';
import { AssignCaracteristicaDto } from './dtos/assign-caracteristica.dto';

@Controller('sucursales-caracteristicas')
export class SucursalesCaracteristicasController {
  constructor(private service: SucursalesCaracteristicasService) {}

  @Post(':sucursal_id')
  assign(
    @Param('sucursal_id') sucursal_id: number,
    @Body() dto: AssignCaracteristicaDto,
  ) {
    return this.service.assignCaracteristica(sucursal_id, dto);
  }

  @Get(':sucursal_id')
  getBySucursal(@Param('sucursal_id') sucursal_id: number) {
    return this.service.getBySucursal(sucursal_id);
  }
}
