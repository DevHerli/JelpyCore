import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
  } from '@nestjs/common';
  import { EventosNegociosService } from './eventos-negocios.service';
  import { CrearEventoNegocioDto } from './dtos/crear-evento-negocio.dto';
  import { MarcarEventosLeidosDto } from './dtos/marcar-eventos-leidos.dto';
  
  @Controller('eventos-negocios')
  export class EventosNegociosController {
    constructor(
      private readonly eventosNegociosService: EventosNegociosService,
    ) {}
  
    @Post()
    crear(@Body() crearEventoNegocioDto: CrearEventoNegocioDto) {
      return this.eventosNegociosService.crear(crearEventoNegocioDto);
    }
  
    @Get()
    obtenerTodos() {
      return this.eventosNegociosService.obtenerTodos();
    }
  
    @Get('no-leidos/suscriptor/:suscriptorId')
    obtenerNoLeidosPorSuscriptor(
      @Param('suscriptorId', ParseIntPipe) suscriptorId: number,
    ) {
      return this.eventosNegociosService.obtenerEventosNoLeidosPorSuscriptor(suscriptorId);
    }
  
    @Post('marcar-leidos')
    marcarEventosComoLeidos(@Body() marcarEventosLeidosDto: MarcarEventosLeidosDto) {
      return this.eventosNegociosService.marcarEventosComoLeidos(marcarEventosLeidosDto);
    }
  
    @Get('negocio/:negocioId')
    obtenerPorNegocio(
      @Param('negocioId', ParseIntPipe) negocioId: number,
    ) {
      return this.eventosNegociosService.obtenerPorNegocio(negocioId);
    }
  
    @Get('sucursal/:sucursalId')
    obtenerPorSucursal(
      @Param('sucursalId', ParseIntPipe) sucursalId: number,
    ) {
      return this.eventosNegociosService.obtenerPorSucursal(sucursalId);
    }
  
    @Get(':id')
    obtenerUno(@Param('id', ParseIntPipe) id: number) {
      return this.eventosNegociosService.obtenerUno(id);
    }
  
    @Patch(':id/desactivar')
    desactivar(@Param('id', ParseIntPipe) id: number) {
      return this.eventosNegociosService.desactivar(id);
    }
  }