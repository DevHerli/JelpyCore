import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BusinessMessage, MessageType } from './entities/business-message.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { SendMessageAdminDto, AdminTargetType } from './dtos/send-message-admin.dto';
import { UpdateMessageAdminDto } from './dtos/update-message-admin.dto';

const CHUNK_SIZE = 500; // filas por INSERT para envíos masivos

@Injectable()
export class AdminMessagesService {
  private readonly logger = new Logger(AdminMessagesService.name);

  constructor(
    @InjectRepository(BusinessMessage)
    private readonly repo: Repository<BusinessMessage>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
  ) {}

  // ─── ENVÍO ────────────────────────────────────────────────────────────────

  /**
   * Crea y distribuye mensajes a uno, varios o todos los suscriptores.
   */
  async enviarMensaje(dto: SendMessageAdminDto) {
    const targetType  = dto.target_type;
    const targetValue = dto.target_value ?? null;

    // Validar: individual y segment requieren target_value
    if (
      (targetType === 'individual' || targetType === 'segment') &&
      !targetValue
    ) {
      throw new BadRequestException(
        'target_value es requerido para target_type individual o segment',
      );
    }

    // Resolver IDs de suscriptores destino
    const subscriberIds = await this.resolverSubscriberIds(targetType, targetValue);

    if (!subscriberIds.length) {
      this.logger.warn(`[Jelpy System] Mensaje sin destinatarios (${targetType}/${targetValue})`);
      return {
        ok: true,
        message: 'No se encontraron suscriptores destino',
        total_sent: 0,
      };
    }

    // Construir base del mensaje
    const base = {
      type:       dto.type,
      title:      dto.title,
      preview:    dto.preview,
      body:       dto.body,
      senderName: dto.sender_name,
      ctaLabel:   dto.cta_label  ?? null,
      ctaRoute:   dto.cta_route  ?? null,
      metadata:   dto.metadata   ?? null,
      isRead:     false,
    };

    // Insertar en lotes para no saturar MySQL
    let totalCreados = 0;
    for (let i = 0; i < subscriberIds.length; i += CHUNK_SIZE) {
      const chunk = subscriberIds.slice(i, i + CHUNK_SIZE);
      const entities = chunk.map((sid) =>
        this.repo.create({ ...base, subscriberId: sid }),
      );
      await this.repo.save(entities);
      totalCreados += entities.length;
    }

    this.logger.log(
      `[Jelpy System] Mensaje "${dto.title}" enviado a ${totalCreados} suscriptores (${targetType})`,
    );

    return {
      ok: true,
      message: 'Mensaje enviado correctamente',
      total_sent: totalCreados,
      target_type:  targetType,
      target_value: targetValue,
    };
  }

  // ─── LISTADO ADMIN ────────────────────────────────────────────────────────

  /**
   * Lista todos los mensajes con filtros y paginación.
   * Útil para ver qué mensajes se enviaron, a quién y cuántos fueron leídos.
   */
  async listarMensajes(opts: {
    page:           number;
    perPage:        number;
    type?:          MessageType | 'all';
    subscriberId?:  number;
    onlyUnread?:    boolean;
  }) {
    const skip = (opts.page - 1) * opts.perPage;

    const qb = this.repo
      .createQueryBuilder('m')
      .orderBy('m.created_at', 'DESC')
      .skip(skip)
      .take(opts.perPage);

    if (opts.type && opts.type !== 'all') {
      qb.andWhere('m.type = :type', { type: opts.type });
    }
    if (opts.subscriberId) {
      qb.andWhere('m.subscriber_id = :sid', { sid: opts.subscriberId });
    }
    if (opts.onlyUnread) {
      qb.andWhere('m.is_read = 0');
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((m) => ({
        id:            m.id,
        subscriber_id: m.subscriberId,
        type:          m.type,
        title:         m.title,
        preview:       m.preview,
        sender_name:   m.senderName,
        is_read:       Boolean(m.isRead),
        cta_label:     m.ctaLabel  ?? null,
        cta_route:     m.ctaRoute  ?? null,
        metadata:      m.metadata  ?? null,
        created_at:    m.createdAt,
      })),
      meta: {
        current_page: opts.page,
        per_page:     opts.perPage,
        total,
        last_page:    Math.ceil(total / opts.perPage) || 1,
      },
    };
  }

  /**
   * Detalle completo de un mensaje (body incluido).
   */
  async obtenerDetalle(id: number) {
    const msg = await this.repo.findOne({ where: { id } });

    if (!msg) throw new NotFoundException('Mensaje no encontrado');

    return {
      id:            msg.id,
      subscriber_id: msg.subscriberId,
      type:          msg.type,
      title:         msg.title,
      preview:       msg.preview,
      body:          msg.body,
      sender_name:   msg.senderName,
      is_read:       Boolean(msg.isRead),
      cta_label:     msg.ctaLabel  ?? null,
      cta_route:     msg.ctaRoute  ?? null,
      metadata:      msg.metadata  ?? null,
      created_at:    msg.createdAt,
      updated_at:    msg.updatedAt,
    };
  }

  /**
   * Edita los campos de contenido de un mensaje ya enviado.
   * No modifica subscriber_id ni created_at.
   * Útil para corregir errores de redacción o actualizar un CTA.
   */
  async editarMensaje(id: number, dto: UpdateMessageAdminDto) {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');

    // Solo aplicar los campos que vienen en el DTO (PATCH parcial)
    if (dto.type        !== undefined) msg.type       = dto.type;
    if (dto.title       !== undefined) msg.title      = dto.title;
    if (dto.preview     !== undefined) msg.preview    = dto.preview;
    if (dto.body        !== undefined) msg.body       = dto.body;
    if (dto.sender_name !== undefined) msg.senderName = dto.sender_name;
    if (dto.cta_label   !== undefined) msg.ctaLabel   = dto.cta_label ?? null;
    if (dto.cta_route   !== undefined) msg.ctaRoute   = dto.cta_route ?? null;
    if (dto.metadata    !== undefined) msg.metadata   = dto.metadata  ?? null;

    const updated = await this.repo.save(msg);

    return {
      ok: true,
      data: {
        id:            updated.id,
        subscriber_id: updated.subscriberId,
        type:          updated.type,
        title:         updated.title,
        preview:       updated.preview,
        body:          updated.body,
        sender_name:   updated.senderName,
        is_read:       Boolean(updated.isRead),
        cta_label:     updated.ctaLabel  ?? null,
        cta_route:     updated.ctaRoute  ?? null,
        metadata:      updated.metadata  ?? null,
        created_at:    updated.createdAt,
        updated_at:    updated.updatedAt,
      },
    };
  }

  /**
   * Elimina un mensaje permanentemente.
   */
  async eliminarMensaje(id: number) {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException('Mensaje no encontrado');

    await this.repo.delete(id);
    return { ok: true };
  }

  /**
   * Estadísticas generales del módulo de mensajes.
   */
  async obtenerStats() {
    // Total de mensajes, leídos/no leídos, desglose por tipo
    const [total, totalLeidos] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { isRead: true as any } }),
    ]);

    const porTipo = await this.repo
      .createQueryBuilder('m')
      .select('m.type',    'type')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(m.is_read)', 'leidos')
      .groupBy('m.type')
      .getRawMany<{ type: string; total: string; leidos: string }>();

    const ultimos7Dias = await this.repo
      .createQueryBuilder('m')
      .select('DATE(m.created_at)', 'fecha')
      .addSelect('COUNT(*)', 'total')
      .where('m.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')
      .groupBy('DATE(m.created_at)')
      .orderBy('fecha', 'ASC')
      .getRawMany<{ fecha: string; total: string }>();

    return {
      total_mensajes:   total,
      total_leidos:     totalLeidos,
      total_no_leidos:  total - totalLeidos,
      tasa_lectura:     total ? `${Math.round((totalLeidos / total) * 100)}%` : '0%',
      por_tipo: porTipo.map((r) => ({
        type:    r.type,
        total:   Number(r.total),
        leidos:  Number(r.leidos),
      })),
      ultimos_7_dias: ultimos7Dias.map((r) => ({
        fecha: r.fecha,
        total: Number(r.total),
      })),
    };
  }

  // ─── HELPERS PRIVADOS ─────────────────────────────────────────────────────

  private async resolverSubscriberIds(
    targetType: AdminTargetType,
    targetValue: string | null,
  ): Promise<number[]> {
    if (targetType === 'individual') {
      // Verificar que el suscriptor exista
      const suscriptor = await this.suscriptorRepo.findOne({
        where: { id: Number(targetValue), eliminado: false },
        select: { id: true } as any,
      });
      return suscriptor ? [suscriptor.id] : [];
    }

    if (targetType === 'segment') {
      // Todos los suscriptores de una ciudad específica
      const rows = await this.suscriptorRepo
        .createQueryBuilder('s')
        .select('s.id', 'id')
        .where('s.ciudad_id = :cityId', { cityId: Number(targetValue) })
        .andWhere('s.eliminado = 0')
        .getRawMany<{ id: number }>();
      return rows.map((r) => Number(r.id));
    }

    if (targetType === 'all') {
      // Todos los suscriptores activos
      const rows = await this.suscriptorRepo
        .createQueryBuilder('s')
        .select('s.id', 'id')
        .where('s.eliminado = 0')
        .getRawMany<{ id: number }>();
      return rows.map((r) => Number(r.id));
    }

    return [];
  }
}
