import { Body, Controller, Get, Param, ParseIntPipe, Post, Patch, Delete } from '@nestjs/common';
import { HorariosSucursalService } from './horarios-sucursal.service';
import { CreateHorarioSucursalDto } from './dto/create-horario-sucursal.dto';
import { UpdateHorarioSucursalDto } from './dto/update-horario-sucursal.dto';

@Controller('horarios-sucursal')
export class HorariosSucursalController {
  constructor(private readonly horariosService: HorariosSucursalService) {}

  @Post()
  crear(@Body() dto: CreateHorarioSucursalDto) {
    return this.horariosService.crear(dto);
  }

  @Get()
  listar() {
    return this.horariosService.listar();
  }

  @Get('sucursal/:sucursalId')
  listarPorSucursal(@Param('sucursalId', ParseIntPipe) sucursalId: number) {
    return this.horariosService.listarPorSucursal(sucursalId);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioSucursalDto,
  ) {
    return this.horariosService.actualizar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.horariosService.eliminar(id);
  }
}
