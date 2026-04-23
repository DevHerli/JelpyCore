import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

import { CaracteristicaSucursal } from './caracteristica-sucursal.entity';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';

@Entity('sucursales_caracteristicas')
@Unique('uk_sucursal_caracteristica', ['sucursal', 'caracteristica'])
@Index('idx_sucursal_caracteristica_sucursal', ['sucursal'])
@Index('idx_sucursal_caracteristica_caracteristica', ['caracteristica'])
export class SucursalCaracteristica {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => SucursalNegocio, (sucursal) => sucursal.caracteristicas, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  @ManyToOne(
    () => CaracteristicaSucursal,
    (caracteristica) => caracteristica.sucursales,
    {
      eager: true,
      onDelete: 'CASCADE',
      nullable: false,
    },
  )
  @JoinColumn({ name: 'caracteristica_id' })
  caracteristica: CaracteristicaSucursal;

  @Column({
    type: 'tinyint',
    width: 1,
    default: 1,
  })
  valor: boolean;

  @CreateDateColumn({
    name: 'fecha_registro',
    type: 'datetime',
  })
  fechaRegistro: Date;
}