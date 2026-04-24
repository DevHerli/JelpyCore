import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EstadosService } from './estados.service';
import { CreateEstadoDto } from './dto/create-estado.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { Estado } from './entities/estado.entity';

@ApiTags('Estados')
@Controller('estados')
export class EstadosController {
  constructor(private readonly estadosService: EstadosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo estado' })
  @ApiResponse({ status: 201, type: Estado })
  create(@Body() dto: CreateEstadoDto) {
    return this.estadosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los estados activos' })
  @ApiResponse({ status: 200, type: [Estado] })
  findAll() {
    return this.estadosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un estado por ID' })
  @ApiResponse({ status: 200, type: Estado })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.estadosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un estado por ID' })
  @ApiResponse({ status: 200, type: Estado })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEstadoDto) {
    return this.estadosService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar (borrado lógico) un estado' })
  @ApiResponse({
    status: 200,
    description: 'Estado eliminado correctamente',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.estadosService.softDelete(id);
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Desactivar (borrado lógico) un estado' })
  @ApiResponse({
    status: 200,
    description: 'Estado desactivado correctamente',
  })
  softDelete(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.estadosService.softDelete(id, body.eliminadoPor);
  }
}
