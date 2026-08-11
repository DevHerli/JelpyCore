import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('membresias')
export class Membresia {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.0 })
  precio: number;

  @Column({ type: 'int', default: 1 })
  duracion_meses: number;

  @Column({ type: 'text', nullable: true })
  beneficios?: string;

  @Column({ type: 'tinyint', default: 1 })
  activo: boolean;

  @CreateDateColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @UpdateDateColumn({ type: 'datetime', nullable: true, onUpdate: 'CURRENT_TIMESTAMP' })
  fecha_actualizacion: Date;

  // Membresia entity
@Column({ name: 'anuncios_mensuales', type: 'int', default: 0 })
anunciosMensuales: number;

@Column({ name: 'anuncios_simultaneos', type: 'int', default: 0 })
anunciosSimultaneos: number;

@Column({ name: 'anuncios_ilimitados', type: 'tinyint', width: 1, default: 0 })
anunciosIlimitados: boolean;

/**
 * ID del Price recurrente mensual en Stripe (price_xxx).
 * NULL en el plan Free (sin cobro).
 * Configurar manualmente en BD tras crear los Products en el dashboard de Stripe.
 */
@Column({ name: 'stripe_price_id', type: 'varchar', length: 100, nullable: true })
stripePriceId?: string;

}
