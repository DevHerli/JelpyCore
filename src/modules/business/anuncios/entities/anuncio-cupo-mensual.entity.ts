import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Negocio } from '../../negocios/entities/negocio.entity';

@Entity('anuncios_cupo_mensual')
export class AnuncioCupoMensual {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Negocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ type: 'tinyint' })
  month: number;

  @Column({ name: 'base_quota', type: 'int', default: 0 })
  baseQuota: number;

  @Column({ name: 'addon_quota', type: 'int', default: 0 })
  addonQuota: number;

  @Column({ name: 'used_quota', type: 'int', default: 0 })
  usedQuota: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', nullable: true, onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt?: Date;
}
