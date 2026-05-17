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
    const skip    = (page - 1) * perPage;

    // Construir where con propiedad camelCase (TypeORM 0.3)
    const where: any = { userId };
    if (filters.unreadOnly) where.isRead = false;
    if (filters.category)   where.notification = { category: filters.category };

    const [items, total] = await this.userNotifRepo.findAndCount({
      where,
      relations: { notification: true },
      order:     { receivedAt: 'DESC' },
      take:      perPage,
      skip,
    });

    const unread = await this.userNotifRepo.count({
      where: { userId, isRead: false },
    });

    const data = items.map((un) => ({
      id:          un.id,
      title:       un.notification?.title       ?? '',
      message:     un.notification?.message     ?? '',
      category:    un.notification?.category    ?? 'system',
      priority:    un.notification?.priority    ?? 'medium',
      image_url:   un.notification?.imageUrl    ?? null,
      cta_label:   un.notification?.ctaLabel    ?? null,
      cta_route:   un.notification?.ctaRoute    ?? null,
      cta_url:     un.notification?.ctaUrl      ?? null,
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

  async getUnreadCount(userId: number): Promise<{ count: number }> {
    const count = await this.userNotifRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // ─── Marcar como leída ────────────────────────────────────────────────────

  async marcarLeida(userNotifId: number, userId: number): Promise<{ ok: boolean }> {
    const record = await this.userNotifRepo.findOne({
      where: { id: userNotifId, userId },
    });

    if (!record) {
      throw new NotFoundException('Notificación no encontrada');
    }

    // Idempotente: si ya estaba leída, retorna ok sin tocar la BD
    if (!record.isRead) {
      record.isRead = true;
      record.readAt = new Date();
      await this.userNotifRepo.save(record);
    }

    return { ok: true };
  }

  async marcarTodasLeidas(userId: number): Promise<{ ok: boolean; updated: number }> {
    const result = await this.userNotifRepo
      .createQueryBuilder()
      .update(UserNotification)
      .set({ isRead: true, readAt: new Date() })
      .where('user_id = :userId AND is_read = 0', { userId })
      .execute();

    return { ok: true, updated: result.affected ?? 0 };
  }
}
