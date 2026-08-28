import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

// Reacción (like / dislike) de un suscriptor sobre una reseña de sucursal.
// Un suscriptor solo puede tener UNA reacción por reseña (unique compuesto):
//  · si vuelve a pulsar el mismo tipo  → se elimina  (toggle off)
//  · si pulsa el tipo contrario        → se cambia   (like ⇄ dislike)
// Los FK se declaran en la migración SQL (synchronize=false en PROD); aquí se
// usan columnas escalares para mantener las queries simples.
@Entity('sucursales_resenas_reacciones')
@Unique('uq_resena_suscriptor', ['resenaId', 'suscriptorId'])
export class SucursalReviewReaccion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index('idx_reaccion_resena')
  @Column({ name: 'resena_id', type: 'bigint', unsigned: true })
  resenaId: number;

  @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
  suscriptorId: number;

  @Column({ type: 'enum', enum: ['like', 'dislike'] })
  tipo: 'like' | 'dislike';

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;
}
