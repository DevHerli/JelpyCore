import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';
import { Suscriptor } from '../../suscriptores/entities/suscriptores.entity';

@Entity('sucursales_resenas')
export class SucursalReview {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // ---------- RELACIONES ----------
  // nullable:false — `sucursal_id` y `suscriptor_id` son NOT NULL. Una reseña
  // sin sucursal o sin autor no se puede atribuir ni moderar.
  @ManyToOne(() => SucursalNegocio, (s) => s.reseñas, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  @ManyToOne(() => Suscriptor, { eager: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  // ---------- DATOS ----------
  @Column({ name: 'nombre_mostrado', length: 150 })
  nombreMostrado: string;

  @Column({ type: 'tinyint', unsigned: true })
  rating: number; // 1 a 5 (validado en DTO)

  @Column({ type: 'text' })
  comentario: string;

  // ---------- RESPUESTA NEGOCIO ----------
  @Column({ name: 'respuesta_negocio', type: 'text', nullable: true })
  respuestaNegocio?: string;

  @Column({ name: 'fecha_respuesta', type: 'datetime', nullable: true })
  fechaRespuesta?: Date;

  // ---------- MODERACIÓN ----------
  @Column({
    type: 'enum',
    enum: ['pendiente', 'publicada', 'rechazada'],
    default: 'publicada',
  })
  estado: 'pendiente' | 'publicada' | 'rechazada';

  // ---------- AUDITORÍA ----------
  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;
}
