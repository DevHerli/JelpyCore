import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { CaracteristicasSucursalService } from './caracteristicas-sucursal.service';
import { CreateCaracteristicaDto } from './dtos/create-caracteristica.dto';
import { UpdateCaracteristicaDto } from './dtos/update-caracteristica.dto';

@Controller('caracteristicas-sucursal')
export class CaracteristicasSucursalController {
  constructor(private service: CaracteristicasSucursalService) {}

  @Post()
  create(@Body() dto: CreateCaracteristicaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateCaracteristicaDto) {
    return this.service.update(id, dto);
  }
}
