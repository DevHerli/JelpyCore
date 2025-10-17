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

  @ManyToOne(() => Categoria, (categoria) => categoria.subcategorias, { eager: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @Column({ type: 'tinyint', default: 1 })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;

  @OneToMany(() => Especialidad, (esp) => esp.subcategoria)
  especialidades: Especialidad[];
}
