/**
 * BillingSubscription — estado de facturación de un negocio con Stripe.
 *
 * Una suscripción de Stripe es por negocio (no por suscriptor):
 *   - Un mismo suscriptor puede tener N negocios con planes diferentes.
 *   - El plan Free no tiene registro aquí (se consulta por ausencia).
 *
 * Ciclo de vida del estatus:
 *   free          → no existe registro (negocio recién creado)
 *   activo        → checkout.session.completed + invoice.paid
 *   pago_pendiente→ invoice.payment_failed
 *   vencido       → customer.subscription.deleted
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Negocio } from '../../business/negocios/entities/negocio.entity';
import { Membresia } from '../../business/membresias/entities/membresia.entity';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';

export type PlanEstatus = 'activo' | 'pago_pendiente' | 'vencido';

@Entity('billing_subscriptions')
@Index('idx_bs_negocio', ['negocio'])
@Index('idx_bs_stripe_sub', ['stripeSubscriptionId'], { unique: true, sparse: true })
@Index('idx_bs_stripe_customer', ['stripeCustomerId'])
export class BillingSubscription {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  /** Negocio al que aplica este plan. */
  @ManyToOne(() => Negocio, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  /** Suscriptor dueño del negocio (denormalizado para queries rápidos). */
  @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  /** Membresía/plan activo (Delux, Premium, Empresarial). */
  @ManyToOne(() => Membresia, { eager: true })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  // ── Identificadores de Stripe ─────────────────────────────────────────────

  /** sub_xxx — ID de la suscripción recurrente en Stripe. */
  @Column({ name: 'stripe_subscription_id', type: 'varchar', length: 120, nullable: true })
  stripeSubscriptionId?: string;

  /** cus_xxx — Stripe Customer del suscriptor. */
  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 120, nullable: true })
  stripeCustomerId?: string;

  /** cs_xxx — ID de la Checkout Session de donde viene esta suscripción. */
  @Column({ name: 'stripe_checkout_session_id', type: 'varchar', length: 120, nullable: true })
  stripeCheckoutSessionId?: string;

  // ── Estado del plan ───────────────────────────────────────────────────────

  @Column({
    name: 'plan_estatus',
    type: 'enum',
    enum: ['activo', 'pago_pendiente', 'vencido'],
    default: 'activo',
  })
  planEstatus: PlanEstatus;

  /**
   * Fecha hasta la cual el plan está vigente.
   * Derivada de `current_period_end` de Stripe (timestamp → DATE).
   */
  @Column({ name: 'plan_vigente_hasta', type: 'date', nullable: true })
  planVigenteHasta?: Date;

  /**
   * Monto en pesos MXN de la última factura pagada.
   * Ayuda a emitir el CFDI con el monto correcto.
   */
  @Column({ name: 'ultimo_monto_mxn', type: 'decimal', precision: 10, scale: 2, nullable: true })
  ultimoMontoMxn?: number;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;
}
