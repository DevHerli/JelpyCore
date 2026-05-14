import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type MessageType =
  | 'payment'
  | 'report'
  | 'system'
  | 'promotion'
  | 'insight';

@Entity('business_messages')
@Index('idx_subscriber', ['subscriberId'])
@Index('idx_type', ['type'])
@Index('idx_is_read', ['isRead'])
export class BusinessMessage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  /** FK a suscriptores.id */
  @Column({ name: 'subscriber_id', type: 'bigint', unsigned: true })
  subscriberId: number;

  @Column({
    type: 'enum',
    enum: ['payment', 'report', 'system', 'promotion', 'insight'],
  })
  type: MessageType;

  @Column({ length: 255 })
  title: string;

  /** Resumen corto (~120 chars) para la lista */
  @Column({ length: 500 })
  preview: string;

  /** Texto completo, párrafos separados por \n\n */
  @Column({ type: 'text' })
  body: string;

  /** Ej. "Equipo Jelpy Negocios" */
  @Column({ name: 'sender_name', length: 150 })
  senderName: string;

  @Column({ name: 'is_read', type: 'tinyint', width: 1, default: 0 })
  isRead: boolean;

  /** Texto del botón CTA (nullable) */
  @Column({ name: 'cta_label', length: 100, nullable: true, default: null })
  ctaLabel: string | null;

  /** Ruta interna app, ej. /tabs/dashboard (nullable) */
  @Column({ name: 'cta_route', length: 255, nullable: true, default: null })
  ctaRoute: string | null;

  /** Datos extras (monto, ticket_id, etc.) */
  @Column({ type: 'json', nullable: true, default: null })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
