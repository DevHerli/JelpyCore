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

  @ManyToOne(() => Categoria, (categoria) => categoria.subcategorias, {
    eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

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

  @OneToMany(() => Especialidad, (esp) => esp.subcategoria)
  especialidades: Especialidad[];
}
