import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Street } from './street.entity';
import { Colonia } from '../../colonias/entities/colonia.entity';

@Entity({ name: 'calles_colonias' })
export class StreetColony {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({
    name: 'calle_id',
    type: 'bigint',
    unsigned: true,
  })
  calle_id: string;

  @Column({
    name: 'colonia_id',
    type: 'bigint',
    unsigned: true,
  })
  colonia_id: string;

  @Column({
    name: 'activo',
    type: 'tinyint',
    width: 1,
    default: () => '1',
  })
  activo: boolean;

  @Column({
    name: 'fecha_creacion',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_creacion: Date;

  @Column({
    name: 'fecha_actualizacion',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fecha_actualizacion: Date;

  @Column({
    name: 'creado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  creado_por?: string | null;

  @Column({
    name: 'actualizado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  actualizado_por?: string | null;

  @Column({
    name: 'eliminado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  eliminado_por?: string | null;

  @ManyToOne(() => Street, (street) => street.callesColonias, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: 'calle_id' })
  calle: Street;

  @ManyToOne(() => Colonia, {
    eager: false,
    nullable: false,
  })
  @JoinColumn({ name: 'colonia_id' })
  colonia: Colonia;
}