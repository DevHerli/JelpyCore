import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification }     from './entities/notification.entity';
import { DeviceToken }      from './entities/device-token.entity';
import { UserNotification } from './entities/user-notification.entity';
import { FirebaseService }  from './firebase.service';
import { SendNotificationDto } from './dtos/send-notification.dto';

const BATCH_INSERT = 1000; // filas por INSERT en user_notifications

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,

    @InjectRepository(DeviceToken)
    private readonly tokenRepo: Repository<DeviceToken>,

    @InjectRepository(UserNotification)
    private readonly userNotifRepo: Repository<UserNotification>,

    private readonly firebaseService: FirebaseService,
  ) {}

  // ─── Enviar notificación ──────────────────────────────────────────────────

  async enviarNotificacion(dto: SendNotificationDto, adminId: number) {
    const targetType  = dto.target_type  ?? 'all';
    const targetValue = dto.target_value ?? null;

    // 1. Crear el registro de la notificación
    const notif = await this.notifRepo.save(
      this.notifRepo.create({
        title:       dto.title,
        message:     dto.message,
        category:    dto.category   ?? 'system',
        priority:    dto.priority   ?? 'medium',
        imageUrl:    dto.image_url  ?? null,
        targetType,
        targetValue,
        ctaLabel:    dto.cta_label  ?? null,
        ctaRoute:    dto.cta_route  ?? null,
        ctaUrl:      dto.cta_url    ?? null,
        sentBy:      adminId,
        sentAt:      new Date(),
        totalSent:   0,
      }),
    );

    // 2. Obtener tokens activos según el segmento
    const { tokens, userIds } = await this.resolverDestinos(targetType, targetValue);

    if (!tokens.length) {
      this.logger.warn(`Notificación ${notif.id}: sin dispositivos destino`);
      return { message: 'Notificación creada, sin dispositivos activos', notification_id: notif.id, total_sent: 0 };
    }

    // 3. Enviar por FCM
    const { successCount, invalidTokens } = await this.firebaseService.sendMulticast(
      tokens,
      {
        title:    dto.title,
        body:     dto.message,
        category: dto.category   ?? 'system',
        priority: dto.priority   ?? 'medium',
        ctaRoute: dto.cta_route  ?? '',
        ctaUrl:   dto.cta_url    ?? '',
        ctaLabel: dto.cta_label  ?? '',
        imageUrl: dto.image_url  ?? '',
      },
    );

    // 4. Marcar tokens inválidos como inactivos (async, no bloquea la respuesta)
    if (invalidTokens.length) {
      this.tokenRepo
        .createQueryBuilder()
        .update(DeviceToken)
        .set({ isActive: false })
        .where('token IN (:...tokens)', { tokens: invalidTokens })
        .execute()
        .catch((e) => this.logger.error('Error limpiando tokens inválidos:', e));
    }

    // 5. Poblar user_notifications en lotes
    if (userIds.length) {
      await this.insertarUserNotifications(userIds, notif.id);
    }

    // 6. Actualizar total_sent
    await this.notifRepo.update(notif.id, { totalSent: successCount });

    return {
      message:         'Notificación enviada correctamente',
      notification_id: notif.id,
      total_sent:      successCount,
    };
  }

  // ─── Historial ────────────────────────────────────────────────────────────

  async listarNotificaciones(page = 1, perPage = 20) {
    const offset = (page - 1) * perPage;

    const [rows, total] = await this.notifRepo
      .createQueryBuilder('n')
      .select([
        'n.id',
        'n.title',
        'n.category',
        'n.priority',
        'n.target_type',
        'n.total_sent',
        'n.sent_at',
        's.nombre',
        's.apellido_paterno',
      ])
      .innerJoin('suscriptores', 's', 's.id = n.sent_by')
      .orderBy('n.created_at', 'DESC')
      .take(perPage)
      .skip(offset)
      .getManyAndCount();

    // getRawMany es más sencillo para proyecciones con JOIN a tablas sin entidad rel.
    const data = await this.notifRepo
      .createQueryBuilder('n')
      .innerJoin('suscriptores', 's', 's.id = n.sent_by')
      .select([
        'n.id           AS id',
        'n.title        AS title',
        'n.category     AS category',
        'n.priority     AS priority',
        'n.target_type  AS target_type',
        'n.total_sent   AS total_sent',
        'n.sent_at      AS sent_at',
        "CONCAT(s.nombre, ' ', s.apellido_paterno) AS sent_by_name",
      ])
      .orderBy('n.created_at', 'DESC')
      .take(perPage)
      .skip(offset)
      .getRawMany();

    return {
      data,
      meta: { total, page, per_page: perPage, last_page: Math.ceil(total / perPage) || 1 },
    };
  }

  async obtenerDetalle(id: number) {
    const notif = await this.notifRepo
      .createQueryBuilder('n')
      .innerJoin('suscriptores', 's', 's.id = n.sent_by')
      .select([
        'n.id           AS id',
        'n.title        AS title',
        'n.message      AS message',
        'n.category     AS category',
        'n.priority     AS priority',
        'n.image_url    AS image_url',
        'n.target_type  AS target_type',
        'n.target_value AS target_value',
        'n.cta_label    AS cta_label',
        'n.cta_route    AS cta_route',
        'n.cta_url      AS cta_url',
        'n.total_sent   AS total_sent',
        'n.sent_at      AS sent_at',
        'n.created_at   AS created_at',
        "CONCAT(s.nombre, ' ', s.apellido_paterno) AS sent_by_name",
      ])
      .where('n.id = :id', { id })
      .getRawOne();

    if (!notif) return null;

    // Estadísticas de lectura
    const totalUsers = await this.userNotifRepo.count({ where: { notificationId: id } });
    const totalRead  = await this.userNotifRepo.count({ where: { notificationId: id, isRead: true } });

    return {
      ...notif,
      stats: {
        total_entregadas: totalUsers,
        total_leidas:     totalRead,
        tasa_lectura:     totalUsers ? `${Math.round((totalRead / totalUsers) * 100)}%` : '0%',
      },
    };
  }

  async obtenerStats() {
    const [totalEnviadas, totalTokensActivos] = await Promise.all([
      this.notifRepo.count(),
      this.tokenRepo.count({ where: { isActive: true } }),
    ]);

    const resumen = await this.notifRepo
      .createQueryBuilder('n')
      .select('n.category AS category, COUNT(*) AS total')
      .groupBy('n.category')
      .getRawMany();

    return {
      total_notificaciones_enviadas: totalEnviadas,
      total_dispositivos_activos:    totalTokensActivos,
      por_categoria: resumen,
    };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Resuelve los tokens FCM y userIds según el tipo de target.
   */
  private async resolverDestinos(
    targetType: string,
    targetValue: string | null,
  ): Promise<{ tokens: string[]; userIds: number[] }> {
    let qb = this.tokenRepo
      .createQueryBuilder('dt')
      .where('dt.is_active = 1');

    if (targetType === 'segment' && targetValue) {
      // Filtra por city_id del suscriptor
      qb = qb
        .innerJoin('suscriptores', 's', 's.id = dt.user_id')
        .andWhere('s.ciudad_id = :cityId', { cityId: targetValue });
    } else if (targetType === 'individual' && targetValue) {
      qb = qb.andWhere('dt.user_id = :userId', { userId: targetValue });
    }

    const rows = await qb.select(['dt.token AS token', 'dt.user_id AS userId']).getRawMany();

    return {
      tokens:  rows.map((r) => r.token),
      userIds: [...new Set(rows.map((r) => Number(r.userId)))],
    };
  }

  /**
   * Inserta en user_notifications en lotes de BATCH_INSERT para evitar
   * un único INSERT con miles de filas.
   */
  private async insertarUserNotifications(
    userIds: number[],
    notificationId: number,
  ): Promise<void> {
    for (let i = 0; i < userIds.length; i += BATCH_INSERT) {
      const chunk = userIds.slice(i, i + BATCH_INSERT);
      await this.userNotifRepo
        .createQueryBuilder()
        .insert()
        .into(UserNotification)
        .values(chunk.map((userId) => ({ userId, notificationId, isRead: false })))
        .orIgnore() // IGNORE si ya existe (evita error por UNIQUE KEY)
        .execute();
    }
  }
}
