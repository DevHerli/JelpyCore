// src/pagos/entities/pago.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type MetodoPago = 'stripe' | 'conekta' | 'transferencia' | 'oxxo' | 'paypal';
export type EstatusPago = 'pendiente' | 'procesando' | 'pagado' | 'fallido' | 'reembolsado';

@Entity({ name: 'pagos' })
@Index('uq_pagos_referencia_externa', ['referenciaExterna'], { unique: true })
export class Pago {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'negocio_id', type: 'bigint', unsigned: true, nullable: true })
  negocioId: string | null;

  @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
  suscriptorId: string;

  @Column({ name: 'membresia_id', type: 'bigint', unsigned: true })
  membresiaId: string;

  // DECIMAL en MySQL => string (TypeORM)
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: string;

  @Column({
    name: 'metodo_pago',
    type: 'enum',
    enum: ['stripe', 'conekta', 'transferencia', 'oxxo', 'paypal'],
    default: 'stripe',
  })
  metodoPago: MetodoPago;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'procesando', 'pagado', 'fallido', 'reembolsado'],
    default: 'pendiente',
  })
  estatus: EstatusPago;

  @Column({ name: 'referencia_externa', type: 'varchar', length: 255, nullable: true })
  referenciaExterna: string | null;

  @Column({ name: 'comprobante_url', type: 'varchar', length: 500, nullable: true })
  comprobanteUrl: string | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion: Date;
}