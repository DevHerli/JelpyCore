import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
   * Ordenado por created_at DESC.
   */
  @Get('tickets')
  listarPorNegocio(@Query('negocio_id') negocioId: string) {
    return this.supportService.listarPorNegocio(Number(negocioId));
  }
}
