import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Membresia } from '../../business/membresias/entities/membresia.entity';

export type ResetPeriodo = 'mensual' | 'anual' | 'una_vez';

@Entity('membresia_cuotas')
@Unique('uq_mc_membresia', ['membresia'])
export class MembresiaCuotas {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // nullable:false — `membresia_id` es NOT NULL y además UNIQUE: las cuotas
  // son la configuración de un plan concreto.
  @ManyToOne(() => Membresia, { nullable: false, onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  @Column({ name: 'max_negocios', type: 'int', default: 0 })
  maxNegocios: number;

  @Column({ name: 'max_promociones', type: 'int', default: 0 })
  maxPromociones: number;

  @Column({ name: 'max_anuncios', type: 'int', default: 0 })
  maxAnuncios: number;

  // JLP-QUOTA — límite de sucursales que puede dar de alta CADA negocio del
  // suscriptor, según su membresía. A diferencia de max_negocios/max_promociones
  // (que se consumen vía consumirCuota()/suscripcion_ciclos, un pool único por
  // suscriptor), este límite se verifica en vivo con un COUNT(*) de sucursales
  // no eliminadas del negocio en cuestión — es un límite por-negocio, no
  // por-suscriptor (ver SucursalesNegociosService.crear()), así que no tiene
  // sentido meterlo en el motor de ciclos (que resetea/acumula por suscripción).
  @Column({ name: 'max_sucursales', type: 'int', default: 0 })
  maxSucursales: number;

  @Column({
    name: 'reset_periodo',
    type: 'enum',
    enum: ['mensual', 'anual', 'una_vez'],
    default: 'mensual',
  })
  resetPeriodo: ResetPeriodo;

  @Column({ name: 'permite_promos_destacadas', type: 'tinyint', width: 1, default: 0 })
  permitePromosDestacadas: boolean;

  @Column({ name: 'permite_anuncios_premium', type: 'tinyint', width: 1, default: 0 })
  permiteAnunciosPremium: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;
}