import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';

import { Anuncio } from './anuncio.entity';
import { Suscriptor } from '../../suscriptores/entities/suscriptores.entity';

export type AnuncioEventType = 'view' | 'click' | 'like' | 'whatsapp' | 'call' | 'maps';

@Entity('anuncios_eventos')
export class AnuncioEvento {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // nullable:false — `anuncio_id` es NOT NULL: un evento mide un anuncio
  // concreto. (`suscriptor_id` sí es opcional: un anónimo también puede verlo.)
  @ManyToOne(() => Anuncio, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'anuncio_id' })
  anuncio: Anuncio;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: ['view', 'click', 'like', 'whatsapp', 'call', 'maps'],
  })
  eventType: AnuncioEventType;

  @ManyToOne(() => Suscriptor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor?: Suscriptor;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
