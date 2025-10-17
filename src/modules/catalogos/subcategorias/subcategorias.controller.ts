import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Delete } from '@nestjs/common';
import { SubcategoriasService } from './subcategorias.service';
import { CreateSubcategoriaDto } from './dto/create-subcategoria.dto';
import { UpdateSubcategoriaDto } from './dto/update-subcategoria.dto';

@Controller('subcategorias')
export class SubcategoriasController {
  constructor(private readonly subcategoriasService: SubcategoriasService) {}

  // Listar todas las subcategorías activas
  @Get()
  listar() {
    return this.subcategoriasService.listar();
  }

  // Obtener una subcategoría específica (incluye especialidades)
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriasService.obtenerPorId(id);
  }

  // Listar subcategorías por ID de categoría
  @Get('by-categoria/:categoriaId')
  listarPorCategoria(@Param('categoriaId', ParseIntPipe) categoriaId: number) {
    return this.subcategoriasService.listarPorCategoria(categoriaId);
  }

  // Listar solo las especialidades de una subcategoría
  @Get(':id/especialidades')
  listarEspecialidades(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriasService.listarEspecialidades(id);
  }

  // 🔹 Crear nueva subcategoría
  @Post()
  crear(@Body() dto: CreateSubcategoriaDto) {
    return this.subcategoriasService.crear(dto);
  }

  // 🔹 Actualizar subcategoría existente
  @Put(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubcategoriaDto,
  ) {
    return this.subcategoriasService.actualizar(id, dto);
  }

  // 🔹 Borrado lógico de subcategoría
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriasService.eliminar(id);
  }
}
