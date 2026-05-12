import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

import { SupportTicket } from './entities/support-ticket.entity';
import { Negocio } from '../business/negocios/entities/negocio.entity';
import { CreateTicketDto } from './dtos/create-ticket.dto';

// Caracteres base36 en mayúsculas para el folio (sin caracteres ambiguos no aplica aquí)
const FOLIO_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,

    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,

    private readonly jwtService: JwtService,
  ) {}

  // ─── Crear ticket ───────────────────────────────────────────────────────────

  async crearTicket(
    dto: CreateTicketDto,
    authHeader?: string,
  ): Promise<{ folio: string; id: number; estado: string; created_at: Date }> {

    // 1. Extraer usuario del token (si viene)
    const usuarioId = this.extraerUsuarioId(authHeader);

    // 2. solicitud_negocio requiere autenticación
    if (dto.tipo === 'solicitud_negocio' && !usuarioId) {
      throw new UnauthorizedException(
        'Se requiere autenticación para enviar una solicitud de negocio',
      );
    }

    // 3. Validar negocio_id: debe existir y pertenecer al usuario autenticado
    if (dto.tipo === 'solicitud_negocio' && dto.negocio_id) {
      const negocio = await this.negocioRepo.findOne({
        where: { id: dto.negocio_id, eliminado: false },
        relations: { suscriptor: true },
      });

      if (!negocio) {
        throw new UnprocessableEntityException(
          `El negocio con id ${dto.negocio_id} no existe`,
        );
      }

      if (Number(negocio.suscriptor.id) !== Number(usuarioId)) {
        throw new UnprocessableEntityException(
          'El negocio no pertenece al usuario autenticado',
        );
      }
    }

    // 4. Regla de negocio: reporte_bug siempre prioridad 'normal'
    const prioridad =
      dto.tipo === 'reporte_bug' ? 'normal' : (dto.prioridad ?? 'normal');

    // 5. Generar folio único JLP-XXXXXX
    const folio = await this.generarFolioUnico();

    // 6. Persistir
    const ticket = this.ticketRepo.create({
      folio,
      tipo:           dto.tipo,
      usuarioId:      usuarioId ?? null,
      negocioId:      dto.negocio_id ?? null,
      categoria:      dto.categoria,
      categoriaLabel: dto.categoria_label,
      problema:       dto.problema,
      problemaLabel:  dto.problema_label,
      descripcion:    dto.descripcion ?? null,
      prioridad,
      estado:         'pendiente',
      agenteId:       null,
      notasInternas:  null,
      resueltoAt:     null,
      cerradoAt:      null,
    });

    const saved = await this.ticketRepo.save(ticket);

    return {
      folio:      saved.folio,
      id:         saved.id,
      estado:     saved.estado,
      created_at: saved.createdAt,
    };
  }

  // ─── Listar tickets de un negocio ───────────────────────────────────────────

  async listarPorNegocio(negocioId: number): Promise<SupportTicket[]> {
    return this.ticketRepo.find({
      where: { negocioId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Extrae y verifica el JWT del header Authorization.
   * - Si no hay header → retorna null (usuario anónimo).
   * - Si hay token pero es inválido/expirado → lanza 401.
   */
  private extraerUsuarioId(authHeader?: string): number | null {
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);
    try {
      const decoded = this.jwtService.verify<{ sub: number }>(token);
      return decoded.sub;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  /**
   * Genera un folio único con formato JLP-XXXXXX.
   * Reintenta hasta 10 veces en caso de colisión (prácticamente imposible
   * con 36^6 = 2.1 mil millones de combinaciones posibles).
   */
  private async generarFolioUnico(): Promise<string> {
    for (let intento = 0; intento < 10; intento++) {
      const sufijo = Array.from(
        { length: 6 },
        () => FOLIO_CHARS[Math.floor(Math.random() * FOLIO_CHARS.length)],
      ).join('');

      const folio = `JLP-${sufijo}`;
      const existe = await this.ticketRepo.findOne({ where: { folio } });
      if (!existe) return folio;
    }

    // Fallback extremadamente improbable: usar timestamp como garantía
    return `JLP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }
}
