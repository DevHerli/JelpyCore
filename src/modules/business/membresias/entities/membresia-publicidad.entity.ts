import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Membresia } from './membresia.entity';

@Entity('membresia_publicidad')
export class MembresiaPublicidad {
  @PrimaryGeneratedColumn()
  id: number;

  // nullable:false — `membresia_id` es NOT NULL: esta fila es la configuración
  // de publicidad de un plan concreto.
  @ManyToOne(() => Membresia, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  @Column({ name: 'placements_permitidos', type: 'json' })
  placementsPermitidos: string[];

  @Column({ type: 'int' })
  prioridad: number;

  @Column({ name: 'max_slots_simultaneos', type: 'int' })
  maxSlotsSimultaneos: number;
}
