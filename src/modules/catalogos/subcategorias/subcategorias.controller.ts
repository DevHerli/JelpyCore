import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { SubcategoriasService } from './subcategorias.service';
import { CreateSubcategoriaDto } from './dto/create-subcategoria.dto';
import { UpdateSubcategoriaDto } from './dto/update-subcategoria.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Subcategoria } from './entities/subcategorias.entity';
import { Especialidad } from '../especialidades/entities/especialidades.entity';

@ApiTags('Subcategorias')
@Controller('subcategorias')
export class SubcategoriasController {
  constructor(private readonly subcategoriasService: SubcategoriasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva subcategoría' })
  @ApiResponse({ status: 201, type: Subcategoria })
  crear(@Body() dto: CreateSubcategoriaDto) {
    return this.subcategoriasService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las subcategorías activas' })
  @ApiResponse({ status: 200, type: [Subcategoria] })
  listar() {
    return this.subcategoriasService.listar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una subcategoría por ID' })
  @ApiResponse({ status: 200, type: Subcategoria })
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriasService.obtenerPorId(id);
  }

  @Get('categoria/:categoriaId')
  @ApiOperation({ summary: 'Listar subcategorías por categoría' })
  @ApiResponse({ status: 200, type: [Subcategoria] })
  listarPorCategoria(@Param('categoriaId', ParseIntPipe) categoriaId: number) {
    return this.subcategoriasService.listarPorCategoria(categoriaId);
  }

  @Get(':id/especialidades')
  @ApiOperation({ summary: 'Listar especialidades de una subcategoría' })
  @ApiResponse({ status: 200, type: [Especialidad] })
  listarEspecialidades(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriasService.listarEspecialidades(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una subcategoría' })
  @ApiResponse({ status: 200, type: Subcategoria })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubcategoriaDto) {
    return this.subcategoriasService.actualizar(id, dto);
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Desactivar (borrado lógico) una subcategoría' })
  @ApiResponse({ status: 200, description: 'Subcategoría desactivada correctamente' })
  eliminar(@Param('id', ParseIntPipe) id: number, @Query('eliminadoPor') eliminadoPor?: number) {
    return this.subcategoriasService.eliminar(id, eliminadoPor);
  }
}
