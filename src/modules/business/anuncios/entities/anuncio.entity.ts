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

}
