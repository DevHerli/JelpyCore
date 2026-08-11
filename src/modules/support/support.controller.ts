import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dtos/create-ticket.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private requesterCtx(req: any): { sub: number; isAdmin: boolean } {
    return {
      sub:     Number(req.user?.sub),
      isAdmin: req.user?.role === 'admin',
    };
  }

  // ─── Endpoints ───────────────────────────────────────────────────────────

  /**
   * Crear un ticket de soporte.
   *
   * Flujo reporte_bug       → POST /support/tickets  (cualquier usuario, auth opcional)
   * Flujo solicitud_negocio → POST /support/tickets  (requiere Bearer token + negocio_id)
   *
   * Respuesta 201:
   * { folio: "JLP-A3F8K2", id: 87, estado: "pendiente", created_at: "..." }
   */
  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  crearTicket(
    @Body() dto: CreateTicketDto,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.supportService.crearTicket(dto, authHeader);
  }

  /**
   * JLP-C11 — Listar tickets de un negocio (para "Mis solicitudes" en el panel).
   *
   * GET /support/tickets?negocio_id=42
   * Devuelve: id, folio, estado, prioridad, categoria_label, problema_label, created_at
   * Ordenado por created_at DESC.
   *
   * Requiere JWT: el usuario autenticado debe ser dueño del negocio (o admin).
   * ParseIntPipe previene inyección de NaN (antes: Number(undefined) = NaN).
   */
  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  listarPorNegocio(
    @Query('negocio_id', ParseIntPipe) negocioId: number,
    @Req() req: any,
  ) {
    const { sub, isAdmin } = this.requesterCtx(req);
    return this.supportService.listarPorNegocio(negocioId, sub, isAdmin);
  }

  /**
   * JLP-C11 — Detalle completo de un ticket por folio.
   *
   * GET /support/tickets/JLP-KPA86Y
   * Devuelve: folio, estado, prioridad, categoria_label, problema_label,
   *           descripcion, created_at, respuesta_agente
   *
   * Requiere JWT: solo el creador del ticket puede verlo (o admin).
   * Los tickets de reporte_bug anónimos (sin usuarioId) son accesibles por
   * cualquier usuario autenticado — el folio CSPRNG actúa como bearer token.
   */
  @Get('tickets/:folio')
  @UseGuards(JwtAuthGuard)
  obtenerPorFolio(@Param('folio') folio: string, @Req() req: any) {
    const { sub, isAdmin } = this.requesterCtx(req);
    return this.supportService.obtenerPorFolio(folio, sub, isAdmin);
  }
}
