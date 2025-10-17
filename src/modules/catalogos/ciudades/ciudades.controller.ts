import { Body, Controller, Get, Param, Post, Put, Delete, ParseIntPipe } from '@nestjs/common';
import { CiudadesService } from './ciudades.service';

@Controller('ciudades')
export class CiudadesController {
  constructor(private readonly ciudadesService: CiudadesService) {}

  @Get()
  listar() {
    return this.ciudadesService.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.ciudadesService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() body: any) {
    return this.ciudadesService.crear(body);
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.ciudadesService.actualizar(id, body);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.ciudadesService.eliminar(id);
  }
}
