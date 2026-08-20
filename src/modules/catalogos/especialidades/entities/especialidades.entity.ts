import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Subcategoria } from '../../subcategorias/entities/subcategorias.entity';

@Entity('especialidades')
export class Especialidad {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // nullable:false — la columna `subcategoria_id` es NOT NULL en la base.
  // Sin esto TypeORM la asume opcional y una especialidad sin subcategoría
  // sólo falla al llegar al INSERT (ER_NO_DEFAULT_FOR_FIELD 1364).
  @ManyToOne(() => Subcategoria, (subcategoria) => subcategoria.especialidades, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'subcategoria_id' })
  subcategoria: Subcategoria;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion?: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;

  @Column({ name: 'creado_por', type: 'bigint', unsigned: true, nullable: true })
  creadoPor?: number;

  @Column({ name: 'actualizado_por', type: 'bigint', unsigned: true, nullable: true })
  actualizadoPor?: number;

  @Column({ name: 'eliminado_por', type: 'bigint', unsigned: true, nullable: true })
  eliminadoPor?: number;
}
