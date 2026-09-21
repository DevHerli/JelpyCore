import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BusinessMessage, MessageType } from './entities/business-message.entity';
import { QueryMessagesDto } from './dtos/query-messages.dto';
import { QueryInboxDto } from './dtos/query-inbox.dto';
import { CreateMessageDto } from './dtos/create-message.dto';

/** Forma snake_case que espera el frontend */
function toSnake(m: BusinessMessage) {
  return {
    id:          m.id,
    type:        m.type,
    title:       m.title,
    preview:     m.preview,
    body:        m.body,
    sender_name: m.senderName,
    is_read:     Boolean(m.isRead),
    cta_label:   m.ctaLabel  ?? null,
    cta_route:   m.ctaRoute  ?? null,
    metadata:    m.metadata  ?? null,
    created_at:  m.createdAt,
  };
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(BusinessMessage)
    private readonly repo: Repository<BusinessMessage>,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────
  // ENDPOINTS DE LECTURA (cliente autenticado)
  // ─────────────────────────────────────────

  async getAll(subscriberId: number, dto: QueryMessagesDto) {
    const perPage = Math.min(dto.per_page, 50);
    const skip    = (dto.page - 1) * perPage;

    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.subscriber_id = :sid', { sid: subscriberId })
      .orderBy('m.created_at', 'DESC');

    if (dto.type && dto.type !== 'all') {
      qb.andWhere('m.type = :type', { type: dto.type });
    }

    // Total filtrado + total no leídos (siempre, independiente del filtro de tipo)
    const [items, total] = await qb.skip(skip).take(perPage).getManyAndCount();

    const unreadTotal = await this.repo.count({
      where: { subscriberId, isRead: false as any },
    });

    return {
      data: items.map(toSnake),
      meta: {
        current_page: dto.page,
        per_page:     perPage,
        total,
        unread_total: unreadTotal,
      },
    };
  }

  async getInbox(subscriberId: number, dto: QueryInboxDto) {
    const page = Math.max(1, Number(dto.page ?? 1));
    const perPage = Math.min(50, Math.max(1, Number(dto.per_page ?? 30)));
    const offset = (page - 1) * perPage;
    const source = dto.source ?? 'all';
    const unreadOnly = String(dto.unread_only ?? '').toLowerCase() === 'true';
    const search = dto.q?.trim();

    const blocks: string[] = [];
    const params: any[] = [];
    const countParams: any[] = [];

    const addMessageBlock = () => {
      let where = `m.subscriber_id = ?`;
      const localParams: any[] = [subscriberId];

      if (unreadOnly) where += ` AND m.is_read = 0`;
      if (search) {
        where += ` AND (m.title LIKE ? OR m.preview LIKE ? OR m.body LIKE ?)`;
        localParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      blocks.push(`
        SELECT
          CONCAT('message:', m.id) AS inbox_id,
          'message' AS source,
          m.id AS source_id,
          m.type AS kind,
          m.title AS title,
          m.preview AS preview,
          m.body AS body,
          m.sender_name AS sender_name,
          m.is_read AS is_read,
          m.cta_label AS cta_label,
          m.cta_route AS cta_route,
          NULL AS cta_url,
          m.metadata AS metadata,
          m.created_at AS created_at
        FROM business_messages m
        WHERE ${where}
      `);
      params.push(...localParams);
      countParams.push(...localParams);
    };

    const addNotificationBlock = () => {
      let where = `un.user_id = ?`;
      const localParams: any[] = [subscriberId];

      if (unreadOnly) where += ` AND un.is_read = 0`;
      if (search) {
        where += ` AND (n.title LIKE ? OR n.message LIKE ?)`;
        localParams.push(`%${search}%`, `%${search}%`);
      }

      blocks.push(`
        SELECT
          CONCAT('notification:', un.id) AS inbox_id,
          'notification' AS source,
          un.id AS source_id,
          n.category AS kind,
          n.title AS title,
          n.message AS preview,
          n.message AS body,
          'Jelpy' AS sender_name,
          un.is_read AS is_read,
          n.cta_label AS cta_label,
          n.cta_route AS cta_route,
          n.cta_url AS cta_url,
          NULL AS metadata,
          un.received_at AS created_at
        FROM user_notifications un
        INNER JOIN notifications n ON n.id = un.notification_id
        WHERE ${where}
      `);
      params.push(...localParams);
      countParams.push(...localParams);
    };

    const addTicketBlock = () => {
      let where = `t.usuario_id = ?`;
      const localParams: any[] = [subscriberId];

      if (unreadOnly) where += ` AND t.estado IN ('pendiente', 'en_atencion')`;
      if (search) {
        where += ` AND (t.folio LIKE ? OR t.categoria_label LIKE ? OR t.problema_label LIKE ? OR t.descripcion LIKE ?)`;
        localParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      blocks.push(`
        SELECT
          CONCAT('ticket:', t.id) AS inbox_id,
          'ticket' AS source,
          t.id AS source_id,
          t.estado AS kind,
          CONCAT('Ticket ', t.folio) AS title,
          CONCAT(t.categoria_label, ' · ', t.problema_label) AS preview,
          COALESCE(t.respuesta_agente, t.descripcion, '') AS body,
          'Soporte Jelpy' AS sender_name,
          CASE WHEN t.estado IN ('resuelto', 'cerrado') THEN 1 ELSE 0 END AS is_read,
          'Ver ticket' AS cta_label,
          CONCAT('/tabs/support/tickets/', t.folio) AS cta_route,
          NULL AS cta_url,
          JSON_OBJECT(
            'folio', t.folio,
            'estado', t.estado,
            'prioridad', t.prioridad,
            'categoria_label', t.categoria_label,
            'problema_label', t.problema_label
          ) AS metadata,
          t.created_at AS created_at
        FROM support_tickets t
        WHERE ${where}
      `);
      params.push(...localParams);
      countParams.push(...localParams);
    };

    if (source === 'all' || source === 'messages') addMessageBlock();
    if (source === 'all' || source === 'notifications') addNotificationBlock();
    if (source === 'all' || source === 'tickets') addTicketBlock();

    const unionSql = blocks.join('\nUNION ALL\n');
    const rows = await this.dataSource.query(
      `
        SELECT *
        FROM (${unionSql}) inbox
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, perPage, offset],
    );

    const countRows = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM (${unionSql}) inbox_count`,
      countParams,
    );

    const total = Number(countRows?.[0]?.total ?? 0);

    return {
      data: rows.map((row: any) => ({
        inbox_id: row.inbox_id,
        source: row.source,
        source_id: Number(row.source_id),
        kind: row.kind,
        title: row.title,
        preview: row.preview,
        body: row.body,
        sender_name: row.sender_name,
        is_read: Boolean(row.is_read),
        cta_label: row.cta_label ?? null,
        cta_route: row.cta_route ?? null,
        cta_url: row.cta_url ?? null,
        metadata: typeof row.metadata === 'string' ? this.safeJson(row.metadata) : row.metadata ?? null,
        created_at: row.created_at,
      })),
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async getById(id: number, subscriberId: number) {
    const msg = await this.repo.findOne({ where: { id } });

    if (!msg) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    // BIGINT en MySQL llega como string desde TypeORM — comparar con Number()
    if (Number(msg.subscriberId) !== Number(subscriberId)) {
      throw new ForbiddenException('No tienes acceso a este mensaje');
    }

    return toSnake(msg);
  }

  async markAsRead(id: number, subscriberId: number) {
    const msg = await this.repo.findOne({ where: { id } });

    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    // BIGINT en MySQL llega como string desde TypeORM — comparar con Number()
    if (Number(msg.subscriberId) !== Number(subscriberId)) {
      throw new ForbiddenException('No tienes acceso a este mensaje');
    }

    if (!msg.isRead) {
      await this.repo.update(id, { isRead: true });
    }

    return { ok: true };
  }

  async markAllAsRead(subscriberId: number) {
    const result = await this.repo
      .createQueryBuilder()
      .update(BusinessMessage)
      .set({ isRead: true })
      .where('subscriber_id = :sid', { sid: subscriberId })
      .andWhere('is_read = 0')
      .execute();

    return { ok: true, updated: result.affected ?? 0 };
  }

  async getUnreadCount(subscriberId: number) {
    // Total no leídos
    const rows = await this.repo
      .createQueryBuilder('m')
      .select('m.type', 'type')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.subscriber_id = :sid', { sid: subscriberId })
      .andWhere('m.is_read = 0')
      .groupBy('m.type')
      .getRawMany<{ type: MessageType; cnt: string }>();

    const byType: Record<string, number> = {};
    let total = 0;

    for (const row of rows) {
      const n = Number(row.cnt);
      byType[row.type] = n;
      total += n;
    }

    return { total, by_type: byType };
  }

  // ─────────────────────────────────────────
  // CREACIÓN INTERNA (servicios / cron jobs)
  // No expuesto en endpoints públicos
  // ─────────────────────────────────────────

  async createMessage(dto: CreateMessageDto): Promise<BusinessMessage> {
    const msg = this.repo.create({
      subscriberId: dto.subscriberId,
      type:         dto.type,
      title:        dto.title,
      preview:      dto.preview,
      body:         dto.body,
      senderName:   dto.senderName,
      ctaLabel:     dto.ctaLabel  ?? null,
      ctaRoute:     dto.ctaRoute  ?? null,
      metadata:     dto.metadata  ?? null,
      isRead:       false,
    });

    return this.repo.save(msg);
  }

  /**
   * Envío masivo a múltiples suscriptores (usado por cron jobs o eventos internos).
   * Ejemplo: notificar a todos los suscriptores con membresía próxima a vencer.
   */
  async createBulkMessages(
    subscriberIds: number[],
    base: Omit<CreateMessageDto, 'subscriberId'>,
  ): Promise<void> {
    if (!subscriberIds.length) return;

    // Insertar en chunks de 500 para no saturar el query
    const CHUNK = 500;
    for (let i = 0; i < subscriberIds.length; i += CHUNK) {
      const chunk = subscriberIds.slice(i, i + CHUNK);
      const entities = chunk.map((sid) =>
        this.repo.create({
          subscriberId: sid,
          type:         base.type,
          title:        base.title,
          preview:      base.preview,
          body:         base.body,
          senderName:   base.senderName,
          ctaLabel:     base.ctaLabel  ?? null,
          ctaRoute:     base.ctaRoute  ?? null,
          metadata:     base.metadata  ?? null,
          isRead:       false,
        }),
      );
      await this.repo.save(entities);
    }
  }

  private safeJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
