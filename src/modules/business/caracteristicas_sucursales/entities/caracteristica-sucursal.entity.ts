import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
  } from 'typeorm';
  import { SucursalCaracteristica } from './sucursal-caracteristica.entity';
  
  @Entity('caracteristicas_sucursal')
  export class CaracteristicaSucursal {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number;
  
    @Column({ type: 'varchar', length: 50, unique: true })
    codigo: string;
  
    @Column({ type: 'varchar', length: 100 })
    nombre: string;
  
    @Column({ type: 'varchar', length: 50 })
    categoria: string; // servicio, pago, ambiente, dieta, etc.
  
    @Column({ type: 'varchar', length: 255, nullable: true })
    descripcion?: string;
  
    @Column({ type: 'varchar', length: 50, default: 'todos' })
    aplica_a: string;
  
    @Column({ type: 'tinyint', default: 1 })
    activo: boolean;
  
    @OneToMany(
      () => SucursalCaracteristica,
      (sc) => sc.caracteristica,
      { cascade: true }
    )
    sucursales: SucursalCaracteristica[];
  }
  