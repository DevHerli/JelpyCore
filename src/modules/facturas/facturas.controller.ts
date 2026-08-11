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
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FacturasService, RequesterCtx } from './facturas.service';
import { SolicitarFacturaDto } from './dtos/solicitar-factura.dto';

/**
 * JLP-H14 — Además del JwtAuthGuard a nivel de clase, cada operación verifica
 * en el servicio que la factura pertenezca al suscriptor autenticado (o admin),
 * evitando IDOR sobre datos fiscales (RFC, razón social) y cancelaciones ajenas.
 */
@Controller('facturas')
@UseGuards(JwtAuthGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  private requester(req: any): RequesterCtx {
    return { sub: Number(req.user?.sub), isAdmin: req.user?.role === 'admin' };
  }

  // ── GET /facturas?suscriptorId=X ─────────────────────────────────────────
  @Get()
  listar(
    @Request() req: any,
    @Query('suscriptorId') suscriptorId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!suscriptorId || isNaN(Number(suscriptorId))) {
      throw new BadRequestException('suscriptorId requerido y debe ser un número');
    }
    return this.facturasService.listar(
      Number(suscriptorId),
      limit ? Number(limit) : 50,
      this.requester(req),
    );
  }

  // ── POST /facturas/solicitar ──────────────────────────────────────────────
  @Post('solicitar')
  solicitar(@Body() dto: SolicitarFacturaDto, @Request() req: any) {
    return this.facturasService.solicitar(dto, this.requester(req));
  }

  // ── GET /facturas/:id ─────────────────────────────────────────────────────
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.facturasService.obtener(id, this.requester(req));
  }

  // ── GET /facturas/:id/pdf ─────────────────────────────────────────────────
  @Get(':id/pdf')
  getPdf(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.facturasService.getPdfUrl(id, this.requester(req));
  }

  // ── GET /facturas/:id/xml ─────────────────────────────────────────────────
  @Get(':id/xml')
  getXml(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.facturasService.getXmlUrl(id, this.requester(req));
  }

  // ── PATCH /facturas/:id/cancelar ──────────────────────────────────────────
  @Patch(':id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.facturasService.cancelar(id, this.requester(req));
  }
}
