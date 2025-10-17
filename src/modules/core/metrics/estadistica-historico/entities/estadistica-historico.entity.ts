import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Negocio } from '../../../../business/negocios/entities/negocio.entity';
import { Ciudad } from '../../../../catalogos/ciudades/entities/ciudades.entity';
import { Membresia } from '../../../../business/membresias/entities/membresia.entity';

@Entity('estadisticas_historico')
export class EstadisticaHistorico {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'date' })
  fecha: string;

  @ManyToOne(() => Negocio)
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  @ManyToOne(() => Ciudad)
  @JoinColumn({ name: 'ciudad_id' })
  ciudad: Ciudad;

  @ManyToOne(() => Membresia, { nullable: true })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  @Column({ type: 'int', unsigned: true, default: 0 })
  vistas: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  clics: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  busquedas: number;

  @Column({
    name: 'fecha_registro',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaRegistro: Date;
}
