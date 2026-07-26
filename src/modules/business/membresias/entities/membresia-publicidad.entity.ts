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

  @ManyToOne(() => Membresia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  @Column({ name: 'placements_permitidos', type: 'json' })
  placementsPermitidos: string[];

  @Column({ type: 'int' })
  prioridad: number;

  @Column({ name: 'max_slots_simultaneos', type: 'int' })
  maxSlotsSimultaneos: number;
}
