import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SucursalNegocio } from '../../../../business/sucursales_negocios/entities/sucursal-negocio.entity';
import { Negocio } from '../../../../business/negocios/entities/negocio.entity';
import { Ciudad } from '../../../../catalogos/ciudades/entities/ciudades.entity';

@Entity('estadisticas_sucursales_historico')
export class EstadisticaSucursalHistorico {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => SucursalNegocio, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  @ManyToOne(() => Negocio, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  @ManyToOne(() => Ciudad, { nullable: true, eager: true })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad?: Ciudad;

  @Column({ type: 'int', unsigned: true, default: 0 })
  vistas: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  clics: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  busquedas: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  fecha: string;
}
