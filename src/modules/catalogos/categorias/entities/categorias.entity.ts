import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Subcategoria } from '../../subcategorias/entities/subcategorias.entity';

@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

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

  // Relación con subcategorías
  @OneToMany(() => Subcategoria, (subcategoria) => subcategoria.categoria)
  subcategorias: Subcategoria[];
}
