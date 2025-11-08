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

  @Column({ type: 'varchar', length: 100, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion?: string;

  @Column({ type: 'tinyint', default: 1 })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;

  // Auditoría (IDs de usuarios del sistema de operaciones)
  @Column({ name: 'creado_por', type: 'bigint', unsigned: true, nullable: true })
  creadoPor?: number;

  @Column({ name: 'actualizado_por', type: 'bigint', unsigned: true, nullable: true })
  actualizadoPor?: number;

  @Column({ name: 'eliminado_por', type: 'bigint', unsigned: true, nullable: true })
  eliminadoPor?: number;

  // Relación con subcategorías
  @OneToMany(() => Subcategoria, (subcategoria) => subcategoria.categoria)
  subcategorias: Subcategoria[];
}
