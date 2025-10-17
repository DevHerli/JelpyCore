import { Body, Controller, Get, Param, Post, Put, Delete, ParseIntPipe } from '@nestjs/common';
import { CategoriasService } from './categorias.service';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  listar() {
    return this.categoriasService.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() body: any) {
    return this.categoriasService.crear(body);
  }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.categoriasService.actualizar(id, body);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.eliminar(id);
  }
}
