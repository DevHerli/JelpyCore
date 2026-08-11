import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

import { SupportTicket } from './entities/support-ticket.entity';
import { Negocio } from '../business/negocios/entities/negocio.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
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

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Crear ticket ───────────────────────────────────────────────────────────

  async crearTicket(
    dto: CreateTicketDto,
    authHeader?: string,
  ): Promise<{ folio: string; id: number; estado: string; created_at: Date }> {

    // 1. Extraer usuario del token (si viene)
    const usuarioId = await this.extraerUsuarioId(authHeader);

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

  /**
   * JLP-C11 — Ownership check: el negocio debe pertenecer al suscriptor
   * autenticado (o ser admin) antes de exponer la lista de tickets.
   */
  async listarPorNegocio(negocioId: number, sub: number, isAdmin: boolean) {
    if (!isAdmin) {
      const negocio = await this.negocioRepo.findOne({
        where: { id: negocioId, eliminado: false },
        relations: { suscriptor: true },
      });

      if (!negocio) {
        throw new NotFoundException(`El negocio con id ${negocioId} no existe`);
      }

      if (Number(negocio.suscriptor.id) !== sub) {
        throw new ForbiddenException('No tienes acceso a los tickets de este negocio.');
      }
    }

    const tickets = await this.ticketRepo.find({
      where: { negocioId },
      order: { createdAt: 'DESC' },
    });

    return tickets.map((t) => ({
      id:              t.id,
      folio:           t.folio,
      estado:          t.estado,
      prioridad:       t.prioridad,
      categoria_label: t.categoriaLabel,
      problema_label:  t.problemaLabel,
      created_at:      t.createdAt,
    }));
  }

  // ─── Detalle de un ticket por folio ─────────────────────────────────────────

  /**
   * JLP-C11 — Ownership check:
   *   - Si el ticket tiene usuarioId (solicitud_negocio), solo ese usuario o admin.
   *   - Si no tiene usuarioId (reporte_bug anónimo), cualquier usuario autenticado
   *     puede acceder con el folio — el folio CSPRNG actúa como bearer token.
   */
  async obtenerPorFolio(folio: string, sub: number, isAdmin: boolean) {
    const ticket = await this.ticketRepo.findOne({ where: { folio } });

    if (!ticket) {
      throw new NotFoundException(`No se encontró el ticket con folio ${folio}`);
    }

    if (!isAdmin && ticket.usuarioId !== null && Number(ticket.usuarioId) !== sub) {
      throw new ForbiddenException('No tienes acceso a este ticket.');
    }

    return {
      folio:            ticket.folio,
      estado:           ticket.estado,
      prioridad:        ticket.prioridad,
      categoria_label:  ticket.categoriaLabel,
      problema_label:   ticket.problemaLabel,
      descripcion:      ticket.descripcion,
      created_at:       ticket.createdAt,
      respuesta_agente: ticket.respuestaAgente ?? null,
    };
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Extrae y verifica el JWT del header Authorization.
   * - Si no hay header → retorna null (usuario anónimo; flujo reporte_bug).
   * - Si hay token pero es inválido/expirado → lanza 401.
   *
   * JLP-M25: este endpoint admite ambos flujos (anónimo y autenticado) en la
   * misma ruta, por lo que no puede protegerse con `@UseGuards(JwtAuthGuard)`
   * sin romper el reporte de bugs anónimo. En su lugar, la verificación manual
   * se endurece para ser CONSISTENTE con JwtAuthGuard (JLP-M06):
   *   1. algorithms: ['HS256'] → rechaza alg:none / algoritmos no esperados.
   *   2. issuer/audience opcionales validados si están configurados.
   *   3. revalidación en BD: la cuenta debe existir y no estar eliminada
   *      (degradación/baja efectiva de inmediato, no al expirar el token).
   */
  private async extraerUsuarioId(authHeader?: string): Promise<number | null> {
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.slice(7);

    const verifyOptions: JwtVerifyOptions = { algorithms: ['HS256'] };
    const issuer = this.config.get<string>('JWT_ISSUER');
    const audience = this.config.get<string>('JWT_AUDIENCE');
    if (issuer) verifyOptions.issuer = issuer;
    if (audience) verifyOptions.audience = audience;

    let decoded: { sub: number };
    try {
      decoded = this.jwtService.verify<{ sub: number }>(token, verifyOptions);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Revalida en BD: cuenta existente y no eliminada.
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id: decoded.sub, eliminado: false },
      select: { id: true } as any,
    });

    if (!suscriptor) {
      throw new UnauthorizedException('Cuenta no encontrada o desactivada');
    }

    return suscriptor.id;
  }

  /**
   * Genera un folio único con formato JLP-XXXXXX.
   * Reintenta hasta 10 veces en caso de colisión (prácticamente imposible
   * con 36^6 = 2.1 mil millones de combinaciones posibles).
   */
  private async generarFolioUnico(): Promise<string> {
    for (let intento = 0; intento < 10; intento++) {
      // JLP-M28: CSPRNG (crypto.randomInt) en vez de Math.random() — el folio
      // es la clave de lectura de GET /support/tickets/:folio; con folios
      // predecibles el read-IDOR residual sería enumerable.
      const sufijo = Array.from(
        { length: 6 },
        () => FOLIO_CHARS[randomInt(FOLIO_CHARS.length)],
      ).join('');

      const folio = `JLP-${sufijo}`;
      const existe = await this.ticketRepo.findOne({ where: { folio } });
      if (!existe) return folio;
    }

    // Fallback extremadamente improbable: usar timestamp como garantía
    return `JLP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }
}
