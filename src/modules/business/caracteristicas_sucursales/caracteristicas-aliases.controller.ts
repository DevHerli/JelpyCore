import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminGuard } from '../../../common/guards/admin.guard';
import { CaracteristicasAliasesService } from './caracteristicas-aliases.service';
import { CreateCaracteristicaAliasDto } from './dtos/create-caracteristica-alias.dto';
import { UpdateCaracteristicaAliasDto } from './dtos/update-caracteristica-alias.dto';

// JLP-H18 — Catálogo maestro: escritura restringida a administradores.
@Controller('caracteristicas-aliases')
export class CaracteristicasAliasesController {
  constructor(private readonly service: CaracteristicasAliasesService) {}

  @Post()
  @UseGuards(AdminGuard)
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
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCaracteristicaAliasDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}