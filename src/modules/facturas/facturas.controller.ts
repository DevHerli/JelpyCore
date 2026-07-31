import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FacturasService } from './facturas.service';
import { SolicitarFacturaDto } from './dtos/solicitar-factura.dto';

@Controller('facturas')
@UseGuards(JwtAuthGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  // ── GET /facturas?suscriptorId=X ─────────────────────────────────────────
  @Get()
  listar(
    @Query('suscriptorId') suscriptorId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!suscriptorId || isNaN(Number(suscriptorId))) {
      throw new BadRequestException('suscriptorId requerido y debe ser un número');
    }
    return this.facturasService.listar(Number(suscriptorId), limit ? Number(limit) : 50);
  }

  // ── POST /facturas/solicitar ──────────────────────────────────────────────
  @Post('solicitar')
  solicitar(@Body() dto: SolicitarFacturaDto) {
    return this.facturasService.solicitar(dto);
  }

  // ── GET /facturas/:id ─────────────────────────────────────────────────────
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.facturasService.obtener(id);
  }

  // ── GET /facturas/:id/pdf ─────────────────────────────────────────────────
  @Get(':id/pdf')
  getPdf(@Param('id', ParseIntPipe) id: number) {
    return this.facturasService.getPdfUrl(id);
  }

  // ── GET /facturas/:id/xml ─────────────────────────────────────────────────
  @Get(':id/xml')
  getXml(@Param('id', ParseIntPipe) id: number) {
    return this.facturasService.getXmlUrl(id);
  }

  // ── PATCH /facturas/:id/cancelar ──────────────────────────────────────────
  @Patch(':id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.facturasService.cancelar(id);
  }
}
