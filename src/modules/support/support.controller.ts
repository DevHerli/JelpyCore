import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dtos/create-ticket.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  /**
   * Crear un ticket de soporte.
   *
   * Flujo reporte_bug     → POST /support/tickets  (cualquier usuario, auth opcional)
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
   * Listar tickets de un negocio (para "Mis solicitudes" en el panel).
   *
   * GET /support/tickets?negocio_id=42
   * Devuelve: id, folio, estado, prioridad, categoria_label, problema_label, created_at
   * Ordenado por created_at DESC.
   */
  @Get('tickets')
  listarPorNegocio(@Query('negocio_id') negocioId: string) {
    return this.supportService.listarPorNegocio(Number(negocioId));
  }

  /**
   * Detalle completo de un ticket por folio.
   *
   * GET /support/tickets/JLP-KPA86Y
   * Devuelve: folio, estado, prioridad, categoria_label, problema_label,
   *           descripcion, created_at, respuesta_agente
   */
  @Get('tickets/:folio')
  obtenerPorFolio(@Param('folio') folio: string) {
    return this.supportService.obtenerPorFolio(folio);
  }
}
