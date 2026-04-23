import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PostalCode } from '../../codigos_postal/entities/postal-code.entity';

@Entity({ name: 'colonias' })
export class Colonia {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({
    name: 'codigo_postal_id',
    type: 'bigint',
    unsigned: true,
  })
  codigo_postal_id: string;

  @Column({
    name: 'nombre',
    type: 'varchar',
    length: 150,
  })
  nombre: string;

  @Column({
    name: 'nombre_normalizado',
    type: 'varchar',
    length: 150,
  })
  nombre_normalizado: string;

  @Column({
    name: 'tipo_asentamiento',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tipo_asentamiento?: string | null;

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

  @ManyToOne(() => PostalCode, { eager: false, nullable: false })
  @JoinColumn({ name: 'codigo_postal_id' })
  codigo_postal: PostalCode;
}