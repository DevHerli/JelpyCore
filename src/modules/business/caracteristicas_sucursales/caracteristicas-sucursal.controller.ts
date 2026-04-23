import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CaracteristicasSucursalService } from './caracteristicas-sucursal.service';
import { CreateCaracteristicaDto } from './dtos/create-caracteristica.dto';
import { UpdateCaracteristicaDto } from './dtos/update-caracteristica.dto';

@Controller('caracteristicas-sucursal')
export class CaracteristicasSucursalController {
  constructor(private readonly service: CaracteristicasSucursalService) {}

  @Post()
  create(@Body() dto: CreateCaracteristicaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('aplicables')
  findAplicables(
    @Query('categoriaId') categoriaId?: string,
    @Query('subcategoriaId') subcategoriaId?: string,
    @Query('especialidadId') especialidadId?: string,
    @Query('tipoServicioId') tipoServicioId?: string,
  ) {
    return this.service.findAplicables({
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      subcategoriaId: subcategoriaId ? Number(subcategoriaId) : undefined,
      especialidadId: especialidadId ? Number(especialidadId) : undefined,
      tipoServicioId: tipoServicioId ? Number(tipoServicioId) : undefined,
    });
  }

  @Get('codigo/:codigo')
  findByCodigo(@Param('codigo') codigo: string) {
    return this.service.findByCodigo(codigo);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCaracteristicaDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}