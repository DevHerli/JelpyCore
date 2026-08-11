import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import {
  SucursalesCaracteristicasService,
  RequesterCtx,
} from './sucursales-caracteristicas.service';
import { AssignCaracteristicaDto } from './dtos/assign-caracteristica.dto';

// JLP-H18B — Escritura restringida al dueño de la sucursal (o admin).
@Controller('sucursales-caracteristicas')
export class SucursalesCaracteristicasController {
  constructor(
    private readonly service: SucursalesCaracteristicasService,
  ) {}

  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  @Post(':sucursal_id')
  @UseGuards(JwtAuthGuard)
  assign(
    @Param('sucursal_id', ParseIntPipe) sucursal_id: number,
    @Body() dto: AssignCaracteristicaDto,
    @Req() req: any,
  ) {
    return this.service.assignCaracteristica(sucursal_id, dto, this.requester(req));
  }

  @Get(':sucursal_id')
  getBySucursal(
    @Param('sucursal_id', ParseIntPipe) sucursal_id: number,
  ) {
    return this.service.getBySucursal(sucursal_id);
  }

  @Get('detalle/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch('detalle/:id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCaracteristicaDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, this.requester(req));
  }

  @Delete('detalle/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, this.requester(req));
  }
}