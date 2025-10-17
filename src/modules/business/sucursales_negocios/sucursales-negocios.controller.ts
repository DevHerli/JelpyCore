import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { SucursalesNegociosService } from './sucursales-negocios.service';
import { CreateSucursalNegocioDto } from './dto/create-sucursal-negocio.dto';
import { UpdateSucursalNegocioDto } from './dto/update-sucursal-negocio.dto';

@Controller('sucursales')
export class SucursalesNegociosController {
  constructor(private readonly service: SucursalesNegociosService) {}

  @Post()
  crear(@Body() dto: CreateSucursalNegocioDto) {
    return this.service.crear(dto);
  }

  @Get()
  listar(
    @Query('negocioId') negocioId?: number,
    @Query('ciudadId') ciudadId?: number,
    @Query('estadoId') estadoId?: number,
  ) {
    return this.service.listar({
      negocioId: negocioId ? Number(negocioId) : undefined,
      ciudadId: ciudadId ? Number(ciudadId) : undefined,
      estadoId: estadoId ? Number(estadoId) : undefined,
    });
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtener(id);
  }

  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSucursalNegocioDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id);
  }

  // Extra útil: listar por negocio
  @Get('/negocio/:negocioId')
  listarPorNegocio(@Param('negocioId', ParseIntPipe) negocioId: number) {
    return this.service.listarPorNegocio(negocioId);
  }
}
