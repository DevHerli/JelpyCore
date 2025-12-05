import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
  } from 'typeorm';
  
  import { CaracteristicaSucursal } from './caracteristica-sucursal.entity';
  import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';
  
  @Entity('sucursales_caracteristicas')
  export class SucursalCaracteristica {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number;
  
    @ManyToOne(() => SucursalNegocio, (s) => s.caracteristicas, {
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'sucursal_id' })
    sucursal: SucursalNegocio;
  
    @ManyToOne(() => CaracteristicaSucursal, (c) => c.sucursales, {
      eager: true,
      onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'caracteristica_id' })
    caracteristica: CaracteristicaSucursal;
  
    @Column({ type: 'tinyint', default: 1 })
    valor: boolean;
  
    @CreateDateColumn({ name: 'fecha_registro' })
    fechaRegistro: Date;
  }
  