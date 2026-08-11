import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  BadRequestException,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dtos/create-categoria.dto';
import { UpdateCategoriaDto } from './dtos/update-categoria.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Categoria } from './entities/categorias.entity';
import { QueryCategoriasDto } from './dtos/query-categorias.dto';

// JLP-H18 — Catálogo maestro: escritura restringida a administradores.
@ApiTags('Categorias')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Crear nueva categoría' })
  @ApiResponse({ status: 201, type: Categoria })
  create(@Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(dto);
  }

  /**
   * GET /categorias
   * Filtros opcionales:
   * - q
   * - activo
   * - fecha_desde
   * - fecha_hasta
   * - includeSubcategorias
   * - orderBy
   * - orderDir
   * - page
   * - limit
   */
  @Get()
  @ApiOperation({ summary: 'Obtener categorías (con filtros opcionales)' })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado con filtros',
  })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'activo', required: false, type: Boolean })
  @ApiQuery({ name: 'fecha_desde', required: false, type: String })
  @ApiQuery({ name: 'fecha_hasta', required: false, type: String })
  @ApiQuery({ name: 'includeSubcategorias', required: false, type: Boolean })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['id', 'nombre', 'fechaCreacion'],
  })
  @ApiQuery({ name: 'orderDir', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query() query: QueryCategoriasDto) {
    return this.categoriasService.findAll(query);
  }

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
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Actualizar una categoría por ID' })
  @ApiResponse({ status: 200, type: Categoria })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.categoriasService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Desactivar (borrado lógico) una categoría' })
  @ApiResponse({
    status: 200,
    description: 'Categoría desactivada correctamente',
  })
  @ApiQuery({
    name: 'eliminadoPor',
    required: true,
    type: Number,
    description: 'ID del usuario que desactiva la categoría',
  })
  softDelete(
    @Param('id', ParseIntPipe) id: number,
    @Query('eliminadoPor') eliminadoPorRaw: string,
  ) {
    // Validar que venga
    if (!eliminadoPorRaw) {
      throw new BadRequestException('El parámetro eliminadoPor es obligatorio.');
    }

    // Convertir a número
    const eliminadoPor = Number(eliminadoPorRaw);

    // Validar NaN
    if (isNaN(eliminadoPor) || eliminadoPor <= 0) {
      throw new BadRequestException(
        'El parámetro eliminadoPor debe ser un número válido mayor a 0.',
      );
    }

    return this.categoriasService.softDelete(id, eliminadoPor);
  }

  @Delete(':id/permanente')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Eliminar una categoría permanentemente (hard delete)' })
  @ApiResponse({
    status: 200,
    description: 'Categoría eliminada permanentemente',
  })
  deletePermanente(@Param('id', ParseIntPipe) id: number) {
    return this.categoriasService.hardDelete(id);
  }
}
