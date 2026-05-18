import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ConversationSession } from './conversation-session.entity';

/**
 * Turno individual dentro de una sesión de conversación.
 * Guarda cada mensaje del usuario y cada respuesta del asistente.
 */
@Entity('conversation_turns')
export class ConversationTurn {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => ConversationSession, (session) => session.turns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: ConversationSession;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  /** 'user' = mensaje del usuario | 'assistant' = respuesta de Jelpy */
  @Column({ name: 'rol', type: 'enum', enum: ['user', 'assistant'] })
  rol: 'user' | 'assistant';

  @Column({ name: 'mensaje', type: 'text' })
  mensaje: string;

  /** Intent detectado para este turno (solo cuando rol='user') */
  @Column({ name: 'intent', type: 'varchar', length: 100, nullable: true })
  intent?: string;

  /** Datos adicionales: filtros aplicados, total de resultados, etc. */
  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: any;

  @Column({
    name: 'creado_en',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  creadoEn: Date;
}
