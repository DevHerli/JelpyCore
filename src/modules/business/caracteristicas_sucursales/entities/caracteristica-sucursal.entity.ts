import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { SucursalCaracteristica } from './sucursal-caracteristica.entity';
import { CaracteristicaAplicabilidad } from './caracteristicas-aplicabilidad.entity';
import { CaracteristicaAlias } from './caracteristica-alias.entity';

@Entity('caracteristicas_sucursal')
export class CaracteristicaSucursal {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'categoria_visual', type: 'varchar', length: 50 })
  categoriaVisual: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icono?: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_registro', type: 'datetime' })
  fechaRegistro: Date;

  @OneToMany(
    () => SucursalCaracteristica,
    (sc) => sc.caracteristica,
    { cascade: true },
  )
  sucursales: SucursalCaracteristica[];

  @OneToMany(
    () => CaracteristicaAplicabilidad,
    (a) => a.caracteristica,
    { cascade: true },
  )
  aplicabilidades: CaracteristicaAplicabilidad[];

  @OneToMany(
  () => CaracteristicaAlias,
  (alias) => alias.caracteristica,
  { cascade: true },
)
aliases: CaracteristicaAlias[];
}