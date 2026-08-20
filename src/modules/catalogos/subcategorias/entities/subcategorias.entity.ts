import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Categoria } from '../../categorias/entities/categorias.entity';
import { Especialidad } from '../../especialidades/entities/especialidades.entity';

@Entity('subcategorias')
export class Subcategoria {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // nullable:false — `categoria_id` es NOT NULL en la base.
  @ManyToOne(() => Categoria, (categoria) => categoria.subcategorias, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion?: string;

  // Campo de activación (sirve para borrado lógico)
  @Column({ type: 'tinyint', default: 1 })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion',
    type: 'datetime',
    nullable: true,
  })
  fechaActualizacion?: Date;

  @Column({
    name: 'creado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: 'ID del usuario en jelpy_operations.usuarios_admin',
  })
  creadoPor?: number;

  @Column({
    name: 'actualizado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: 'ID del usuario en jelpy_operations.usuarios_admin',
  })
  actualizadoPor?: number;

  @Column({
    name: 'eliminado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: 'ID del usuario en jelpy_operations.usuarios_admin',
  })
  eliminadoPor?: number;

  @OneToMany(() => Especialidad, (esp) => esp.subcategoria)
  especialidades: Especialidad[];
}
