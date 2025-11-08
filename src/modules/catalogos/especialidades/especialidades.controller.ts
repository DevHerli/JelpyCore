import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { EspecialidadesService } from './especialidades.service';
import { CreateEspecialidadDto } from './dto/create-especialidad.dto';
import { UpdateEspecialidadDto } from './dto/update-especialidad.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Especialidad } from './entities/especialidades.entity';

@ApiTags('Especialidades')
@Controller('especialidades')
export class EspecialidadesController {
  constructor(private readonly especialidadesService: EspecialidadesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva especialidad' })
  @ApiResponse({ status: 201, type: Especialidad })
  crear(@Body() dto: CreateEspecialidadDto) {
    return this.especialidadesService.crear(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las especialidades activas' })
  @ApiResponse({ status: 200, type: [Especialidad] })
  listar() {
    return this.especialidadesService.listar();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una especialidad por ID' })
  @ApiResponse({ status: 200, type: Especialidad })
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.especialidadesService.obtenerPorId(id);
  }

  @Get('subcategoria/:subcategoriaId')
  @ApiOperation({ summary: 'Listar especialidades por subcategoría' })
  @ApiResponse({ status: 200, type: [Especialidad] })
  listarPorSubcategoria(@Param('subcategoriaId', ParseIntPipe) subcategoriaId: number) {
    return this.especialidadesService.listarPorSubcategoria(subcategoriaId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una especialidad' })
  @ApiResponse({ status: 200, type: Especialidad })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEspecialidadDto) {
    return this.especialidadesService.actualizar(id, dto);
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Desactivar (borrado lógico) una especialidad' })
  @ApiResponse({ status: 200, description: 'Especialidad desactivada correctamente' })
  eliminar(@Param('id', ParseIntPipe) id: number, @Query('eliminadoPor') eliminadoPor?: number) {
    return this.especialidadesService.eliminar(id, eliminadoPor);
  }
}
