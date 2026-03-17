import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { SuscriptorSuscripcion } from './suscriptor-suscripcion.entity';

@Entity('suscripcion_ciclos')
@Unique('uq_ciclo_unico', ['suscripcion', 'cicloInicio', 'cicloFin'])
@Index('idx_sc_suscripcion', ['suscripcion'])
@Index('idx_sc_rango', ['cicloInicio', 'cicloFin'])
export class SuscripcionCiclo {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => SuscriptorSuscripcion, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'suscripcion_id' })
  suscripcion: SuscriptorSuscripcion;

  @Column({ name: 'ciclo_inicio', type: 'date' })
  cicloInicio: Date;

  @Column({ name: 'ciclo_fin', type: 'date' })
  cicloFin: Date;

  @Column({ name: 'negocios_usados', type: 'int', default: 0 })
  negociosUsados: number;

  @Column({ name: 'promociones_usadas', type: 'int', default: 0 })
  promocionesUsadas: number;

  @Column({ name: 'anuncios_usados', type: 'int', default: 0 })
  anunciosUsados: number;

  @Column({ name: 'negocios_extra', type: 'int', default: 0 })
  negociosExtra: number;

  @Column({ name: 'promociones_extra', type: 'int', default: 0 })
  promocionesExtra: number;

  @Column({ name: 'anuncios_extra', type: 'int', default: 0 })
  anunciosExtra: number;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;
}