import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessMessage, MessageType } from './entities/business-message.entity';
import { QueryMessagesDto } from './dtos/query-messages.dto';
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

  async getById(id: number, subscriberId: number) {
    const msg = await this.repo.findOne({ where: { id } });

    if (!msg) {
      throw new NotFoundException('Mensaje no encontrado');
    }
    if (msg.subscriberId !== subscriberId) {
      throw new ForbiddenException('No tienes acceso a este mensaje');
    }

    return toSnake(msg);
  }

  async markAsRead(id: number, subscriberId: number) {
    const msg = await this.repo.findOne({ where: { id } });

    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    if (msg.subscriberId !== subscriberId) {
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
}
