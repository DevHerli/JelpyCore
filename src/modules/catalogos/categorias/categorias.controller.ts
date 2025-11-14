import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dtos/create-categoria.dto';
import { UpdateCategoriaDto } from './dtos/update-categoria.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Categoria } from './entities/categorias.entity';

@ApiTags('Categorias')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva categoría' })
  @ApiResponse({ status: 201, type: Categoria })
  create(@Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las categorías activas' })
  @ApiResponse({ status: 200, type: [Categoria] })
  findAll() {
    return this.categoriasService.findAll();
  }

  // ✅ NUEVO ENDPOINT agregado (no se modificó nada anterior)
  @Get('activas')
  @ApiOperation({ summary: 'Obtener solo las categorías activas' })
  @ApiResponse({ status: 200, type: [Categoria] })
  findActivas() {
    return this.categoriasService.findActivas();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría por ID' })
  @ApiResponse({ status: 200, type: Categoria })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una categoría por ID' })
  @ApiResponse({ status: 200, type: Categoria })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoriaDto) {
    return this.categoriasService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Desactivar (borrado lógico) una categoría' })
  @ApiResponse({ status: 200, description: 'Categoría desactivada correctamente' })
  softDelete(
    @Param('id', ParseIntPipe) id: number,
    @Query('eliminadoPor') eliminadoPor?: number,
  ) {
    return this.categoriasService.softDelete(id, eliminadoPor);
  }
}
