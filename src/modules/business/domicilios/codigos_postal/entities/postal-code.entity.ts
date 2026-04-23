import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ciudad } from '../../../../catalogos/ciudades/entities/ciudades.entity';

@Entity({ name: 'codigos_postales' })
export class PostalCode {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ name: 'ciudad_id', type: 'bigint', unsigned: true })
  ciudad_id: string;

  @Column({ name: 'codigo_postal', type: 'varchar', length: 10 })
  codigo_postal: string;

  @Column({
    name: 'tipo_asentamiento_principal',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tipo_asentamiento_principal?: string | null;

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

  @ManyToOne(() => Ciudad, { eager: false, nullable: false })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad: Ciudad;
}