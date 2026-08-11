import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { EstadisticaHistoricoService } from './estadistica-historico.service';
import { CreateEstadisticaHistoricoDto } from './dto/create-estadistica-historico.dto';
import { AdminGuard } from '../../../../common/guards/admin.guard';

@Controller('estadisticas-historico')
export class EstadisticaHistoricoController {
  constructor(private readonly service: EstadisticaHistoricoService) {}

  // JLP-M24: la escritura de históricos la hace el CRON diario vía SQL directo;
  // el endpoint HTTP no tiene llamador legítimo → solo admin (evita inyección de métricas).
  @UseGuards(AdminGuard)
  @Post()
  registrar(@Body() dto: CreateEstadisticaHistoricoDto) {
    return this.service.registrar(dto);
  }

  // JLP-M24: BI histórica de plataforma → solo admin.
  @UseGuards(AdminGuard)
  @Get('rango')
  listarPorRango(
    @Query('fecha_inicio') fechaInicio: string,
    @Query('fecha_fin') fechaFin: string,
    @Query('ciudad_id') ciudadId?: number,
  ) {
    return this.service.listarPorRango(fechaInicio, fechaFin, ciudadId);
  }
}
