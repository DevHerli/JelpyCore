import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DeviceToken }    from './entities/device-token.entity';
import { UserNotification } from './entities/user-notification.entity';
import { RegisterTokenDto } from './dtos/register-token.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokenRepo: Repository<DeviceToken>,

    @InjectRepository(UserNotification)
    private readonly userNotifRepo: Repository<UserNotification>,
  ) {}

  // ─── Token FCM ────────────────────────────────────────────────────────────

  /**
   * Registra o actualiza el token FCM del dispositivo.
   * Si el token ya existe (otro usuario) lo reasigna al usuario actual.
   */
  async registrarToken(dto: RegisterTokenDto, userId: number): Promise<{ message: string }> {
    let tokenEntity = await this.tokenRepo.findOne({
      where: { token: dto.token },
    });

    if (tokenEntity) {
      // Actualizar aunque sea de otro usuario — el dispositivo cambió de cuenta
      tokenEntity.userId     = userId;
      tokenEntity.platform   = dto.platform;
      tokenEntity.deviceName = dto.device_name ?? null;
      tokenEntity.isActive   = true;
    } else {
      tokenEntity = this.tokenRepo.create({
        userId,
        token:      dto.token,
        platform:   dto.platform,
        deviceName: dto.device_name ?? null,
        isActive:   true,
      });
    }

    await this.tokenRepo.save(tokenEntity);
    return { message: 'Token registrado correctamente' };
  }

  /**
   * Desactiva el token al cerrar sesión.
   * No lanza error si el token no existe (idempotente).
   */
  async eliminarToken(token: string, userId: number): Promise<{ message: string }> {
    await this.tokenRepo.update(
      { token, userId },
      { isActive: false },
    );
    return { message: 'Token eliminado correctamente' };
  }

  // ─── Bandeja de entrada ───────────────────────────────────────────────────

  async getBandeja(
    userId: number,
    filters: {
      page?: number;
      perPage?: number;
      category?: string;
      unreadOnly?: boolean;
    },
  ) {
    const page    = Math.max(1, filters.page    ?? 1);
    const perPage = Math.min(50, filters.perPage ?? 20);
    const offset  = (page - 1) * perPage;

    const qb = this.userNotifRepo
      .createQueryBuilder('un')
      .innerJoinAndSelect('un.notification', 'n')
      .where('un.user_id = :userId', { userId });

    if (filters.unreadOnly) {
      qb.andWhere('un.is_read = 0');
    }

    if (filters.category) {
      qb.andWhere('n.category = :category', { category: filters.category });
    }

    const [items, total] = await qb
      .orderBy('un.received_at', 'DESC')
      .take(perPage)
      .skip(offset)
      .getManyAndCount();

    const unread = await this.userNotifRepo.count({
      where: { userId, isRead: false },
    });

    const data = items.map((un) => ({
      id:          un.id,
      title:       un.notification.title,
      message:     un.notification.message,
      category:    un.notification.category,
      priority:    un.notification.priority,
      image_url:   un.notification.imageUrl,
      cta_label:   un.notification.ctaLabel,
      cta_route:   un.notification.ctaRoute,
      cta_url:     un.notification.ctaUrl,
      is_read:     un.isRead,
      received_at: un.receivedAt,
    }));

    return {
      data,
      meta: {
        total,
        unread,
        page,
        per_page: perPage,
        last_page: Math.ceil(total / perPage) || 1,
      },
    };
  }

  async getUnreadCount(userId: number): Promise<{ unread: number }> {
    const unread = await this.userNotifRepo.count({
      where: { userId, isRead: false },
    });
    return { unread };
  }

  // ─── Marcar como leída ────────────────────────────────────────────────────

  async marcarLeida(userNotifId: number, userId: number): Promise<{ message: string }> {
    const record = await this.userNotifRepo.findOne({
      where: { id: userNotifId, userId },
    });

    if (!record) {
      throw new NotFoundException('Notificación no encontrada');
    }

    if (!record.isRead) {
      record.isRead = true;
      record.readAt = new Date();
      await this.userNotifRepo.save(record);
    }

    return { message: 'Notificación marcada como leída' };
  }

  async marcarTodasLeidas(userId: number): Promise<{ message: string }> {
    await this.userNotifRepo
      .createQueryBuilder()
      .update(UserNotification)
      .set({ isRead: true, readAt: new Date() })
      .where('user_id = :userId AND is_read = 0', { userId })
      .execute();

    return { message: 'Todas las notificaciones marcadas como leídas' };
  }
}
