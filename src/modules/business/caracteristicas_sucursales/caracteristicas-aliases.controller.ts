import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CaracteristicasAliasesService } from './caracteristicas-aliases.service';
import { CreateCaracteristicaAliasDto } from './dtos/create-caracteristica-alias.dto';
import { UpdateCaracteristicaAliasDto } from './dtos/update-caracteristica-alias.dto';

@Controller('caracteristicas-aliases')
export class CaracteristicasAliasesController {
  constructor(private readonly service: CaracteristicasAliasesService) {}

  @Post()
  create(@Body() dto: CreateCaracteristicaAliasDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('caracteristica/:caracteristicaId')
  findByCaracteristica(
    @Param('caracteristicaId', ParseIntPipe) caracteristicaId: number,
  ) {
    return this.service.findByCaracteristica(caracteristicaId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCaracteristicaAliasDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}