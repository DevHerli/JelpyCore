import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Negocio } from '../../negocios/entities/negocio.entity';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';

export type AnuncioStatus = 'draft' | 'active' | 'paused' | 'finished' | 'rejected';

@Entity('anuncios')
export class Anuncio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Negocio, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  @ManyToOne(() => SucursalNegocio, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal?: SucursalNegocio;

  @Column({ length: 150 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ name: 'imagen_url', length: 255, nullable: true })
  imagenUrl?: string;

  @Column({ name: 'fecha_inicio', type: 'datetime' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'datetime' })
  fechaFin: Date;

  @Column({
    type: 'enum',
    enum: ['draft', 'active', 'paused', 'finished', 'rejected'],
    default: 'draft',
  })
  status: AnuncioStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', nullable: true, onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt?: Date;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  eliminado: boolean;

  @Column({ name: 'cupo_consumido', type: 'tinyint', width: 1, default: 0 })
  cupoConsumido: boolean;

  @Column({ name: 'imagen_public_id', type: 'varchar', length: 255, nullable: true })
  imagenPublicId?: string;

  // --- Publicidad v2 ---
  @Column({ name: 'ciudad_id', type: 'int', nullable: true })
  ciudadId?: number;

  @Column({
    name: 'placement',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  placement?: string;

  @Column({ name: 'categoria', type: 'varchar', length: 64, nullable: true })
  categoria?: string;

  @Column({ name: 'prioridad', type: 'int', default: 0 })
  prioridad: number;

  @Column({ name: 'vistas', type: 'int', default: 0 })
  vistas: number;

  @Column({ name: 'clicks', type: 'int', default: 0 })
  clicks: number;

  @Column({ name: 'cta_label', type: 'varchar', length: 100, nullable: true })
  ctaLabel?: string;

  @Column({ name: 'external_url', type: 'varchar', length: 255, nullable: true })
  externalUrl?: string;
}
