import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Negocio } from '../../negocios/entities/negocio.entity';

export type AddonStatus = 'pending' | 'paid' | 'failed';

@Entity('anuncios_addons')
export class AnuncioAddon {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Negocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ type: 'tinyint' })
  month: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'enum', enum: ['pending', 'paid', 'failed'], default: 'pending' })
  status: AddonStatus;

  @Column({ type: 'enum', enum: ['stripe'], default: 'stripe' })
  provider: 'stripe';

  @Column({ name: 'provider_ref', type: 'varchar', length: 255, nullable: true })
  providerRef?: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;


}
