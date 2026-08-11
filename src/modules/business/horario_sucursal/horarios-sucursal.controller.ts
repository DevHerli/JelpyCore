import { Body, Controller, Get, Param, ParseIntPipe, Post, Patch, Delete, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { HorariosSucursalService, RequesterCtx } from './horarios-sucursal.service';
import { CreateHorarioSucursalDto } from './dto/create-horario-sucursal.dto';
import { UpdateHorarioSucursalDto } from './dto/update-horario-sucursal.dto';

/**
 * JLP-C12 — Mutaciones protegidas con JwtAuthGuard + propiedad de la sucursal
 * (verificada en el servicio). Los GET se mantienen públicos (horarios visibles al público).
 */
@Controller('horarios-sucursal')
export class HorariosSucursalController {
  constructor(private readonly horariosService: HorariosSucursalService) {}

  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  crear(@Body() dto: CreateHorarioSucursalDto, @Request() req: any) {
    return this.horariosService.crear(dto, this.requester(req));
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
  @UseGuards(JwtAuthGuard)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioSucursalDto,
    @Request() req: any,
  ) {
    return this.horariosService.actualizar(id, dto, this.requester(req));
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.horariosService.eliminar(id, this.requester(req));
  }
}
