import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { EstadisticaHistoricoService } from './estadistica-historico.service';
import { CreateEstadisticaHistoricoDto } from './dto/create-estadistica-historico.dto';

@Controller('estadisticas-historico')
export class EstadisticaHistoricoController {
  constructor(private readonly service: EstadisticaHistoricoService) {}

  @Post()
  registrar(@Body() dto: CreateEstadisticaHistoricoDto) {
    return this.service.registrar(dto);
  }

  @Get('rango')
  listarPorRango(
    @Query('fecha_inicio') fechaInicio: string,
    @Query('fecha_fin') fechaFin: string,
    @Query('ciudad_id') ciudadId?: number,
  ) {
    return this.service.listarPorRango(fechaInicio, fechaFin, ciudadId);
  }
}
