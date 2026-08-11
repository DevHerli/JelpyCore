import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
  } from '@nestjs/common';
  import { EventosNegociosService, RequesterCtx } from './eventos-negocios.service';
  import { CrearEventoNegocioDto } from './dtos/crear-evento-negocio.dto';
  import { MarcarEventosLeidosDto } from './dtos/marcar-eventos-leidos.dto';
  import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
  import { AdminGuard } from '../../../common/guards/admin.guard';

  @Controller('eventos-negocios')
  export class EventosNegociosController {
    constructor(
      private readonly eventosNegociosService: EventosNegociosService,
    ) {}

    // JLP-M23: contexto del solicitante desde el token (role reescrito por JwtAuthGuard/JLP-M06).
    private requester(req: any): RequesterCtx {
      return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
    }

    // JLP-M23: crear evento exige JWT + propiedad del negocio (verificada en el servicio).
    @UseGuards(JwtAuthGuard)
    @Post()
    crear(@Req() req: any, @Body() crearEventoNegocioDto: CrearEventoNegocioDto) {
      return this.eventosNegociosService.crear(crearEventoNegocioDto, this.requester(req));
    }

    // JLP-M23: listado global de todos los eventos → solo admin (evita exposición masiva).
    @UseGuards(AdminGuard)
    @Get()
    obtenerTodos() {
      return this.eventosNegociosService.obtenerTodos();
    }

    // JLP-M23: feed personal → JWT + solo el propio suscriptor (o admin).
    @UseGuards(JwtAuthGuard)
    @Get('no-leidos/suscriptor/:suscriptorId')
    obtenerNoLeidosPorSuscriptor(
      @Req() req: any,
      @Param('suscriptorId', ParseIntPipe) suscriptorId: number,
    ) {
      const { sub, isAdmin } = this.requester(req);
      if (!isAdmin && suscriptorId !== sub) {
        throw new ForbiddenException('No puedes leer eventos de otro suscriptor');
      }
      return this.eventosNegociosService.obtenerEventosNoLeidosPorSuscriptor(suscriptorId);
    }

    // JLP-M23: marcar leídos → JWT + identidad (suscriptorId) tomada del token.
    @UseGuards(JwtAuthGuard)
    @Post('marcar-leidos')
    marcarEventosComoLeidos(
      @Req() req: any,
      @Body() marcarEventosLeidosDto: MarcarEventosLeidosDto,
    ) {
      marcarEventosLeidosDto.suscriptorId = Number(req.user?.sub);
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
  
    // JLP-M23: desactivar exige JWT + propiedad del negocio del evento (verificada en el servicio).
    @UseGuards(JwtAuthGuard)
    @Patch(':id/desactivar')
    desactivar(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
      return this.eventosNegociosService.desactivar(id, this.requester(req));
    }
  }