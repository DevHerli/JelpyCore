import { Controller, Get, Query } from '@nestjs/common';
import { FiltrosBusquedaService } from './filtros_busqueda.service';
import { FiltrosBusquedaDto } from './dto/filtros-busqueda.dto';

@Controller('busqueda')
export class FiltrosBusquedaController {
  constructor(private readonly filtrosbusquedaService: FiltrosBusquedaService) {}

  @Get()
  async buscar(@Query() filtros: FiltrosBusquedaDto) {
    return this.filtrosbusquedaService.buscar(filtros);
  }
}
