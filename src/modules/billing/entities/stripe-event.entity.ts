/**
 * StripeProcessedEvent — log de idempotencia para eventos de webhook.
 *
 * Stripe puede reenviar el mismo evento varias veces (reintentos).
 * Antes de procesar cualquier evento guardamos su ID aquí.
 * Si ya existe → se devuelve 200 sin reprocesar (idempotente).
 *
 * TTL: los eventos se pueden limpiar después de 90 días ya que Stripe
 * no reenvía eventos más antiguos que ese periodo.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('stripe_processed_events')
export class StripeProcessedEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  /** evt_xxx — ID único del evento de Stripe. */
  @Index({ unique: true })
  @Column({ name: 'stripe_event_id', type: 'varchar', length: 100 })
  stripeEventId: string;

  /** Tipo del evento: checkout.session.completed, invoice.paid, etc. */
  @Column({ name: 'event_type', type: 'varchar', length: 80 })
  eventType: string;

  /** Estatus de procesamiento (success | error). */
  @Column({
    name: 'status',
    type: 'enum',
    enum: ['success', 'error'],
    default: 'success',
  })
  status: 'success' | 'error';

  /** Mensaje de error si el procesamiento falló. */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn({ name: 'fecha_procesado', type: 'datetime' })
  fechaProcesado: Date;
}
