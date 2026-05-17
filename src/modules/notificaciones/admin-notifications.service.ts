import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification }       from './entities/notification.entity';
import { DeviceToken }        from './entities/device-token.entity';
import { UserNotification }   from './entities/user-notification.entity';
import { OneSignalService }   from './onesignal.service';
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

    private readonly oneSignalService: OneSignalService,
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

    // 2. Resolver usuarios destino
    const userIds = await this.resolverUserIds(targetType, targetValue);

    if (!userIds.length && targetType !== 'all') {
      this.logger.warn(`Notificación ${notif.id}: sin usuarios destino`);
      return { message: 'Notificación creada, sin usuarios destino', notification_id: notif.id, total_sent: 0 };
    }

    const pushPayload = {
      title:    dto.title,
      body:     dto.message,
      category: dto.category  ?? 'system',
      priority: dto.priority  ?? 'medium',
      ctaRoute: dto.cta_route ?? '',
      ctaUrl:   dto.cta_url   ?? '',
      ctaLabel: dto.cta_label ?? '',
      imageUrl: dto.image_url ?? '',
    };

    // 3. Enviar por OneSignal (REST API, sin SDK instalado)
    let successCount: number;
    if (targetType === 'all') {
      successCount = await this.oneSignalService.sendToAll(pushPayload);
    } else {
      successCount = await this.oneSignalService.sendToUsers(userIds, pushPayload);
    }

    // 4. Poblar user_notifications en lotes (bandeja de entrada)
    if (userIds.length) {
      await this.insertarUserNotifications(userIds, notif.id);
    }

    // 5. Actualizar total_sent
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

    // LEFT JOIN en lugar de INNER JOIN — sent_by = 0 (Jelpy System) no tiene
    // registro en suscriptores, con INNER se pierde toda la fila.
    const total = await this.notifRepo.count();

    const data = await this.notifRepo
      .createQueryBuilder('n')
      .leftJoin('suscriptores', 's', 's.id = n.sent_by')
      .select([
        'n.id           AS id',
        'n.title        AS title',
        'n.category     AS category',
        'n.priority     AS priority',
        'n.target_type  AS target_type',
        'n.total_sent   AS total_sent',
        'n.sent_at      AS sent_at',
        "COALESCE(CONCAT(s.nombre, ' ', s.apellido_paterno), 'Jelpy System') AS sent_by_name",
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
      .leftJoin('suscriptores', 's', 's.id = n.sent_by')
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
        "COALESCE(CONCAT(s.nombre, ' ', s.apellido_paterno), 'Jelpy System') AS sent_by_name",
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

  async eliminarNotificacion(id: number) {
    const notif = await this.notifRepo.findOne({ where: { id } });
    if (!notif) throw new Error('Notificación no encontrada');
    await this.notifRepo.delete(id);
    return { ok: true };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Resuelve los userIds destino según el tipo de segmento.
   * OneSignal envía a "All" directamente — solo necesitamos los IDs
   * para poblar user_notifications en BD.
   */
  private async resolverUserIds(
    targetType: string,
    targetValue: string | null,
  ): Promise<number[]> {
    if (targetType === 'all') {
      // Para 'all', OneSignal lo maneja internamente.
      // Obtenemos todos los user_ids con token activo para la BD.
      const rows = await this.tokenRepo
        .createQueryBuilder('dt')
        .select('DISTINCT dt.user_id', 'userId')
        .where('dt.is_active = 1')
        .getRawMany();
      return rows.map((r) => Number(r.userId));
    }

    if (targetType === 'segment' && targetValue) {
      const rows = await this.tokenRepo
        .createQueryBuilder('dt')
        .innerJoin('suscriptores', 's', 's.id = dt.user_id')
        .select('DISTINCT dt.user_id', 'userId')
        .where('dt.is_active = 1')
        .andWhere('s.ciudad_id = :cityId', { cityId: targetValue })
        .getRawMany();
      return rows.map((r) => Number(r.userId));
    }

    if (targetType === 'individual' && targetValue) {
      return [Number(targetValue)];
    }

    return [];
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
