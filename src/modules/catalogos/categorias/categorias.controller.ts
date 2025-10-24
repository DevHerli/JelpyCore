import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Crear una nueva categoría' })
  @ApiResponse({ status: 201, description: 'Creada', type: Categoria })
  create(@Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías' })
  @ApiResponse({ status: 200, description: 'OK', type: [Categoria] })
  findAll() {
    return this.categoriasService.findAll();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una categoría' })
  @ApiResponse({ status: 200, description: 'Actualizada', type: Categoria })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.categoriasService.update(id, dto);
  }
}
