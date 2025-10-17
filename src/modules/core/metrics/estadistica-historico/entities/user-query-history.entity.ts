import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Suscriptor } from '../../../../business/suscriptores/entities/suscriptores.entity';

@Entity('historial_consultas_usuarios')
export class UserQueryHistory {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Suscriptor, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor?: Suscriptor | null;

  @Column({ name: 'mensaje_original', type: 'text' })
  mensajeOriginal: string;

  @Column({ name: 'mensaje_corregido', type: 'text', nullable: true })
  mensajeCorregido?: string;

  @Column({
    name: 'resultado_moderacion',
    type: 'enum',
    enum: ['permitido', 'bloqueado'],
    default: 'permitido',
  })
  resultadoModeracion: 'permitido' | 'bloqueado';

  @Column({ name: 'palabra_detectada', type: 'varchar', length: 100, nullable: true })
  palabraDetectada?: string;

  @Column({ name: 'ip_usuario', type: 'varchar', length: 45, nullable: true })
  ipUsuario?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'fecha_registro', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fechaRegistro: Date;
}
