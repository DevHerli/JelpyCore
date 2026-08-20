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
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';
import { Membresia } from '../../business/membresias/entities/membresia.entity';

export type EstatusSuscripcion =
  | 'activa'
  | 'en_mora'
  | 'cancelada'
  | 'expirada'
  | 'prueba';

@Entity('suscriptor_suscripciones')
@Index('idx_ss_suscriptor', ['suscriptor'])
@Index('idx_ss_estatus', ['estatus'])
@Index('idx_ss_corte', ['proximaFechaCorte'])
export class SuscriptorSuscripcion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // nullable:false — ambas columnas son NOT NULL. Una suscripción sin titular
  // o sin plan no se puede cobrar ni renovar.
  @ManyToOne(() => Suscriptor, { nullable: false, onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  @ManyToOne(() => Membresia, { eager: true, nullable: false })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  @Column({
    type: 'enum',
    enum: ['activa', 'en_mora', 'cancelada', 'expirada', 'prueba'],
    default: 'activa',
  })
  estatus: EstatusSuscripcion;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin?: Date;

  @Column({ name: 'proxima_fecha_corte', type: 'date', nullable: true })
  proximaFechaCorte?: Date;

  @Column({ name: 'renovacion_automatica', type: 'tinyint', width: 1, default: 0 })
  renovacionAutomatica: boolean;

  @Column({ name: 'proveedor_pago', type: 'varchar', length: 30, nullable: true })
  proveedorPago?: string;

  @Column({ name: 'proveedor_suscripcion_id', type: 'varchar', length: 120, nullable: true })
  proveedorSuscripcionId?: string;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;
}