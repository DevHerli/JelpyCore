import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type NotifCategory = 'traffic' | 'government' | 'community' | 'ads' | 'system';
export type NotifPriority = 'low' | 'medium' | 'high';
export type TargetType    = 'all' | 'segment' | 'individual';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: ['traffic', 'government', 'community', 'ads', 'system'],
    default: 'system',
  })
  category: NotifCategory;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  })
  priority: NotifPriority;

  @Column({ name: 'image_url', type: 'varchar', length: 512, nullable: true })
  imageUrl: string | null;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: ['all', 'segment', 'individual'],
    default: 'all',
  })
  targetType: TargetType;

  @Column({ name: 'target_value', type: 'varchar', length: 255, nullable: true })
  targetValue: string | null;

  @Column({ name: 'cta_label', type: 'varchar', length: 100, nullable: true })
  ctaLabel: string | null;

  @Column({ name: 'cta_route', type: 'varchar', length: 255, nullable: true })
  ctaRoute: string | null;

  @Column({ name: 'cta_url', type: 'varchar', length: 512, nullable: true })
  ctaUrl: string | null;

  // FK → suscriptores.id (admin que envió)
  @Column({ name: 'sent_by', type: 'bigint', unsigned: true })
  sentBy: number;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'total_sent', type: 'int', default: 0 })
  totalSent: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
