import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtService, JwtVerifyOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';

import { EstadoTicket, PrioridadTicket, SupportTicket, TipoTicket } from './entities/support-ticket.entity';
import { Negocio } from '../business/negocios/entities/negocio.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { CreateTicketDto } from './dtos/create-ticket.dto';
import { AdminUpdateTicketDto } from './dtos/admin-update-ticket.dto';

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

  // ─── Listar tickets del suscriptor autenticado (sin importar negocio) ──────

  /**
   * Todos los tickets levantados por el suscriptor autenticado, sin importar
   * desde dónde entró a soporte (perfil, mensajes o ficha de un negocio en
   * particular). Se filtra por usuarioId (columna independiente de negocioId
   * en SupportTicket, seteada en todo ticket creado por un usuario autenticado).
   * No requiere ownership check adicional: el propio JWT ya limita el alcance
   * a los tickets del usuario que hace la petición.
   */
  async listarPorUsuario(usuarioId: number) {
    const tickets = await this.ticketRepo.find({
      where: { usuarioId },
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

  // ─── ADMIN: listar todos los tickets (JelpySystem) ─────────────────────────

  /**
   * Panel admin — a diferencia de listarPorNegocio(), esta NO filtra por
   * negocio_id (los tickets de tipo reporte_bug ni siquiera tienen negocio
   * asociado) y expone todos los campos de gestión (agente, notas internas).
   * Protegido con AdminGuard a nivel de controller.
   */
  async listarAdmin(filters: {
    estado?: EstadoTicket;
    tipo?: TipoTicket;
    prioridad?: PrioridadTicket;
    categoria?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit =
      filters.limit && filters.limit > 0 && filters.limit <= 100 ? filters.limit : 20;

    const qb = this.ticketRepo.createQueryBuilder('t').orderBy('t.createdAt', 'DESC');

    if (filters.estado) qb.andWhere('t.estado = :estado', { estado: filters.estado });
    if (filters.tipo) qb.andWhere('t.tipo = :tipo', { tipo: filters.tipo });
    if (filters.prioridad) qb.andWhere('t.prioridad = :prioridad', { prioridad: filters.prioridad });
    // Filtro exacto por categoría — usado por los tabs del panel admin
    // (facturacion, promociones, tecnico, cuenta, pagos, privacidad, otro).
    if (filters.categoria) qb.andWhere('t.categoria = :categoria', { categoria: filters.categoria });
    if (filters.q) {
      qb.andWhere(
        '(t.folio LIKE :q OR t.categoriaLabel LIKE :q OR t.problemaLabel LIKE :q OR t.descripcion LIKE :q)',
        { q: `%${filters.q}%` },
      );
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const enriquecidos = await this.resolverNombres(rows);

    return {
      data: enriquecidos,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** Panel admin — detalle completo por id numérico (incluye notas internas). */
  async obtenerDetalleAdmin(id: number) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`No se encontró el ticket con id ${id}`);
    }
    const [enriquecido] = await this.resolverNombres([ticket]);
    return enriquecido;
  }

  /**
   * Panel admin — actualizar estado / respuesta / notas internas / agente.
   * - resuelto_at / cerrado_at se llenan automáticamente al entrar a ese estado.
   * - Si se marca 'en_atencion' y el ticket no tiene agente asignado, se
   *   autoasigna al admin que hace el cambio (a menos que venga agente_id explícito).
   */
  async actualizarAdmin(id: number, dto: AdminUpdateTicketDto, adminSub: number) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`No se encontró el ticket con id ${id}`);
    }

    if (dto.estado !== undefined) {
      ticket.estado = dto.estado;
      if (dto.estado === 'resuelto') ticket.resueltoAt = new Date();
      if (dto.estado === 'cerrado') ticket.cerradoAt = new Date();
    }

    if (dto.respuesta_agente !== undefined) ticket.respuestaAgente = dto.respuesta_agente;
    if (dto.notas_internas !== undefined) ticket.notasInternas = dto.notas_internas;

    if (dto.agente_id !== undefined) {
      ticket.agenteId = dto.agente_id;
    } else if (dto.estado === 'en_atencion' && ticket.agenteId == null) {
      ticket.agenteId = adminSub;
    }

    const saved = await this.ticketRepo.save(ticket);
    const [enriquecido] = await this.resolverNombres([saved]);
    return enriquecido;
  }

  /** Resuelve en batch nombre/correo de usuario solicitante, negocio y agente. */
  private async resolverNombres(tickets: SupportTicket[]) {
    if (!tickets.length) return [];

    const usuarioIds = [...new Set(tickets.map((t) => t.usuarioId).filter((v): v is number => v != null))];
    const negocioIds = [...new Set(tickets.map((t) => t.negocioId).filter((v): v is number => v != null))];
    const agenteIds = [...new Set(tickets.map((t) => t.agenteId).filter((v): v is number => v != null))];
    const subIds = [...new Set([...usuarioIds, ...agenteIds])];

    const [suscriptores, negocios] = await Promise.all([
      subIds.length
        ? this.suscriptorRepo.find({
            where: { id: In(subIds) },
            select: { id: true, nombre: true, apellidoPaterno: true, correoElectronico: true } as any,
          })
        : [],
      negocioIds.length
        ? this.negocioRepo.find({
            where: { id: In(negocioIds) },
            select: { id: true, nombreNegocio: true } as any,
          })
        : [],
    ]);

    const subMap = new Map<number, Suscriptor>(
      suscriptores.map((s): [number, Suscriptor] => [Number(s.id), s]),
    );
    const negocioMap = new Map<number, Negocio>(
      negocios.map((n): [number, Negocio] => [Number(n.id), n]),
    );

    return tickets.map((t) => {
      const usuario = t.usuarioId != null ? subMap.get(Number(t.usuarioId)) : undefined;
      const agente = t.agenteId != null ? subMap.get(Number(t.agenteId)) : undefined;
      const negocio = t.negocioId != null ? negocioMap.get(Number(t.negocioId)) : undefined;

      return {
        id: t.id,
        folio: t.folio,
        tipo: t.tipo,
        estado: t.estado,
        prioridad: t.prioridad,
        categoria: t.categoria,
        categoria_label: t.categoriaLabel,
        problema: t.problema,
        problema_label: t.problemaLabel,
        descripcion: t.descripcion,
        respuesta_agente: t.respuestaAgente,
        notas_internas: t.notasInternas,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
        resuelto_at: t.resueltoAt,
        cerrado_at: t.cerradoAt,
        usuario: usuario
          ? {
              id: usuario.id,
              nombre: `${usuario.nombre} ${usuario.apellidoPaterno ?? ''}`.trim(),
              correo: usuario.correoElectronico ?? null,
            }
          : null,
        negocio: negocio ? { id: negocio.id, nombre: negocio.nombreNegocio } : null,
        agente: agente
          ? {
              id: agente.id,
              nombre: `${agente.nombre} ${agente.apellidoPaterno ?? ''}`.trim(),
              correo: agente.correoElectronico ?? null,
            }
          : null,
      };
    });
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
