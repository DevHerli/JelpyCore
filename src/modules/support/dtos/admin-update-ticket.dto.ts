import { IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { EstadoTicket } from '../entities/support-ticket.entity';

/**
 * DTO para gestión de tickets desde el panel admin (JelpySystem).
 * Todos los campos son opcionales — PATCH parcial.
 */
export class AdminUpdateTicketDto {
  @IsOptional()
  @IsEnum(['pendiente', 'en_atencion', 'resuelto', 'cerrado'], {
    message: 'estado debe ser pendiente, en_atencion, resuelto o cerrado',
  })
  estado?: EstadoTicket;

  // Respuesta visible para el suscriptor que abrió el ticket.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  respuesta_agente?: string;

  // Notas internas — solo visibles en el panel admin, nunca al suscriptor.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas_internas?: string;

  // Reasignar el ticket a otro agente (suscriptor con role='admin').
  @IsOptional()
  @IsInt()
  @Min(1)
  agente_id?: number;
}
