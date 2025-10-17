import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Suscriptor } from '../../../../business/suscriptores/entities/suscriptores.entity';

@Entity('reportes_moderacion')
export class ReporteModeracion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Suscriptor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor?: Suscriptor;

  @Column({ name: 'mensaje_original', type: 'text' })
  mensajeOriginal: string;

  @Column({ name: 'mensaje_corregido', type: 'text', nullable: true })
  mensajeCorregido?: string;

  @Column({ type: 'varchar', length: 255 })
  motivo: string;

  @Column({
    type: 'enum',
    enum: ['grosería', 'amenaza', 'violencia', 'otro'],
    default: 'grosería',
  })
  tipo: 'grosería' | 'amenaza' | 'violencia' | 'otro';

  // 🟢 ESTE ES EL CAMPO QUE CAUSABA EL ERROR
  @Column({ name: 'ip_usuario', type: 'varchar', length: 45, nullable: true })
  ipUsuario?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({
    name: 'fecha_registro',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaRegistro: Date;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  atendido: boolean;

  @Column({ type: 'text', nullable: true })
  observaciones?: string | null;
}
