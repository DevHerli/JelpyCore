import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { CaracteristicaSucursal } from './caracteristica-sucursal.entity';

@Entity('caracteristicas_aplicabilidad')
export class CaracteristicaAplicabilidad {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => CaracteristicaSucursal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caracteristica_id' })
  caracteristica: CaracteristicaSucursal;

  @Column({ name: 'caracteristica_id', type: 'bigint', unsigned: true })
  caracteristicaId: number;

  @Column({
    type: 'enum',
    enum: ['categoria', 'subcategoria', 'especialidad', 'tipo_servicio', 'todos'],
    default: 'todos',
  })
  nivel: 'categoria' | 'subcategoria' | 'especialidad' | 'tipo_servicio' | 'todos';

  @Column({
    name: 'referencia_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  referenciaId: number | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_registro', type: 'datetime' })
  fechaRegistro: Date;
}