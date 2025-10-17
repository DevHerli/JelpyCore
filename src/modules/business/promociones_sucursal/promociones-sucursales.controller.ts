import { Body, Controller, Get, Param, ParseIntPipe, Post, Patch, Delete } from '@nestjs/common';
import { PromocionesSucursalesService } from './promociones-sucursales.service';
import { CreatePromocionSucursalDto } from './dto/create-promocion-sucursal.dto';
import { UpdatePromocionSucursalDto } from './dto/update-promocion-sucursal.dto';
import { Query } from '@nestjs/common';

@Controller('promociones-sucursales')
export class PromocionesSucursalesController {
  constructor(private readonly promoService: PromocionesSucursalesService) {}

  @Post()
  crear(@Body() dto: CreatePromocionSucursalDto) {
    return this.promoService.crear(dto);
  }

  @Get()
  listar() {
    return this.promoService.listar();
  }

  @Get('sucursal/:sucursalId')
  listarPorSucursal(@Param('sucursalId', ParseIntPipe) sucursalId: number) {
    return this.promoService.listarPorSucursal(sucursalId);
  }

  @Get('activas')
    listarPromocionesActivas(@Query('ciudadId') ciudadId?: number) {
    return this.promoService.listarPromocionesActivas(ciudadId ? Number(ciudadId) : undefined);
}

  @Get('activas/filtradas')
    listarPromocionesActivasFiltradas(
    @Query('ciudadId') ciudadId?: number,
    @Query('categoriaId') categoriaId?: number,
    @Query('subcategoriaId') subcategoriaId?: number,
    ) {
    return this.promoService.listarPromocionesActivasFiltradas(
            ciudadId ? Number(ciudadId) : undefined,
            categoriaId ? Number(categoriaId) : undefined,
            subcategoriaId ? Number(subcategoriaId) : undefined,
        );
    }

@Get('proximas')
listarPromocionesProximas(
  @Query('ciudadId') ciudadId?: number,
  @Query('categoriaId') categoriaId?: number,
  @Query('subcategoriaId') subcategoriaId?: number,
) {
  return this.promoService.listarPromocionesProximas(
    ciudadId ? Number(ciudadId) : undefined,
    categoriaId ? Number(categoriaId) : undefined,
    subcategoriaId ? Number(subcategoriaId) : undefined,
  );
}


@Get('finalizadas')
listarPromocionesFinalizadas(
  @Query('ciudadId') ciudadId?: number,
  @Query('categoriaId') categoriaId?: number,
  @Query('subcategoriaId') subcategoriaId?: number,
) {
  return this.promoService.listarPromocionesFinalizadas(
    ciudadId ? Number(ciudadId) : undefined,
    categoriaId ? Number(categoriaId) : undefined,
    subcategoriaId ? Number(subcategoriaId) : undefined,
  );
}

@Get('resumen')
obtenerResumen() {
  return this.promoService.obtenerResumenPromociones();
}

@Get('estadisticas')
obtenerEstadisticas() {
  return this.promoService.obtenerEstadisticasPromociones();
}


@Post(':id/vista')
async registrarVista(@Param('id') id: number) {
  return this.promoService.registrarVista(id);
}

@Post(':id/clic')
async registrarClic(@Param('id') id: number) {
  return this.promoService.registrarClic(id);
}

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromocionSucursalDto) {
    return this.promoService.actualizar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.eliminar(id);
  }
}
