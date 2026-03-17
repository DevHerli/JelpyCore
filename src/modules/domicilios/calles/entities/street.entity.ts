import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StreetColony } from './street-colony.entity';

@Entity({ name: 'calles' })
export class Street {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 180,
  })
  nombre: string;

  @Column({
    name: 'nombre_normalizado',
    type: 'varchar',
    length: 180,
  })
  nombre_normalizado: string;

  @Column({
    name: 'tipo_vialidad',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  tipo_vialidad?: string | null;

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

  @OneToMany(() => StreetColony, (streetColony) => streetColony.calle)
  callesColonias: StreetColony[];
}