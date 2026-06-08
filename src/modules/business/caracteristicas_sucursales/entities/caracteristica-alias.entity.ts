import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CaracteristicaSucursal } from './caracteristica-sucursal.entity';

@Entity('caracteristicas_aliases')
@Index('idx_caracteristica_alias_caracteristica', ['caracteristicaId'])
@Index('idx_caracteristica_alias_alias', ['alias'])
export class CaracteristicaAlias {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'caracteristica_id', type: 'bigint', unsigned: true })
  caracteristicaId: number;

  @ManyToOne(() => CaracteristicaSucursal, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'caracteristica_id' })
  caracteristica: CaracteristicaSucursal;

  @Column({ type: 'varchar', length: 120 })
  alias: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_registro', type: 'datetime' })
  fechaRegistro: Date;
}