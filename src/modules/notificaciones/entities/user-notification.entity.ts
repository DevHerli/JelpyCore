import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

@Entity('user_notifications')
export class UserNotification {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // FK → suscriptores.id
  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  // FK → notifications.id
  @Column({ name: 'notification_id', type: 'bigint', unsigned: true })
  notificationId: number;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @ManyToOne(() => Notification, { eager: false })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;
}
