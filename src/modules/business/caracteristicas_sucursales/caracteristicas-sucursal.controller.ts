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
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CaracteristicasSucursalService } from './caracteristicas-sucursal.service';
import { CreateCaracteristicaDto } from './dtos/create-caracteristica.dto';
import { UpdateCaracteristicaDto } from './dtos/update-caracteristica.dto';

// JLP-H18 — Catálogo maestro: escritura restringida a administradores.
@Controller('caracteristicas-sucursal')
export class CaracteristicasSucursalController {
  constructor(private readonly service: CaracteristicasSucursalService) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateCaracteristicaDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  /**
   * Características filtradas por categoría/subcategoría (query params manuales).
   * GET /caracteristicas-sucursal/aplicables?categoriaId=1&subcategoriaId=2
   */
  @Get('aplicables')
  findAplicables(
    @Query('categoriaId') categoriaId?: string,
    @Query('subcategoriaId') subcategoriaId?: string,
    @Query('especialidadId') especialidadId?: string,
    @Query('tipoServicioId') tipoServicioId?: string,
  ) {
    return this.service.findAplicables({
      categoriaId:    categoriaId    ? Number(categoriaId)    : undefined,
      subcategoriaId: subcategoriaId ? Number(subcategoriaId) : undefined,
      especialidadId: especialidadId ? Number(especialidadId) : undefined,
      tipoServicioId: tipoServicioId ? Number(tipoServicioId) : undefined,
    });
  }

  /**
   * Características aplicables resueltas automáticamente desde el sucursalId.
   * El front solo necesita el ID de la sucursal — el back resuelve la categoría del negocio.
   * GET /caracteristicas-sucursal/aplicables/sucursal/42
   */
  @Get('aplicables/sucursal/:sucursalId')
  findAplicablesBySucursal(
    @Param('sucursalId', ParseIntPipe) sucursalId: number,
  ) {
    return this.service.findAplicablesBySucursal(sucursalId);
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
  @UseGuards(AdminGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCaracteristicaDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}