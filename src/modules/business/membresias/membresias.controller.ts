import { Controller, Get, Post, Delete, Param, Body, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { MembresiasService } from './membresias.service';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';

/**
 * JLP-C17 — Las membresías definen precios y planes (modelo de ingresos).
 * La escritura (crear/actualizar/eliminar) queda restringida a administradores
 * (AdminGuard verifica JWT + role='admin' en BD). La lectura permanece pública
 * porque el front la consume para mostrar los planes disponibles.
 */
@Controller('membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Get()
  listar() {
    return this.membresiasService.listar();
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.membresiasService.obtenerPorId(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  crear(@Body() dto: CreateMembresiaDto) {
    return this.membresiasService.crear(dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMembresiaDto,
  ) {
    return this.membresiasService.actualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.membresiasService.eliminar(id);
  }
}
