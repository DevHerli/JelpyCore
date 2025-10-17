import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';

@Entity('horarios_sucursal')
export class HorarioSucursal {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => SucursalNegocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  @Column({
    name: 'dia_semana',
    type: 'enum',
    enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  })
  diaSemana: string;

  @Column({ name: 'hora_apertura', type: 'time' })
  horaApertura: string;

  @Column({ name: 'hora_cierre', type: 'time' })
  horaCierre: string;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  cerrado: boolean;

  @Column({ length: 255, nullable: true })
  observaciones?: string;

  @Column({
    name: 'fecha_registro',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaRegistro: Date;

  @Column({
    name: 'fecha_actualizacion',
    type: 'datetime',
    nullable: true,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion?: Date;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  eliminado: boolean;
}
