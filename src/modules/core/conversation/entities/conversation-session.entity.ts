import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { ConversationTurn } from './conversation-turn.entity';

/**
 * Sesión de conversación por usuario.
 * Guarda el contexto de la última búsqueda y el historial de turnos.
 * TTL de inactividad: 30 minutos (manejado por ConversationService).
 */
@Entity('conversation_sessions')
export class ConversationSession {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string; // UUID generado por el frontend o el servicio

  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true, nullable: true })
  usuarioId?: number;

  @Column({ name: 'ciudad', type: 'varchar', length: 100, nullable: true })
  ciudad?: string;

  /** Última intención detectada: 'buscar_negocios', 'chat', etc. */
  @Column({ name: 'ultimo_intent', type: 'varchar', length: 100, nullable: true })
  ultimoIntent?: string;

  /** Últimos resultados de búsqueda (máx. 10 items resumidos) */
  @Column({ name: 'ultimo_resultado', type: 'json', nullable: true })
  ultimoResultado?: any[];

  /** Últimos filtros aplicados: { categoriaId, subcategoriaId, ciudad, etc. } */
  @Column({ name: 'ultimos_filtros', type: 'json', nullable: true })
  ultimosFiltros?: any;

  /** Última query de búsqueda en texto plano */
  @Column({ name: 'ultima_query', type: 'varchar', length: 255, nullable: true })
  ultimaQuery?: string;

  @Column({ name: 'activa', type: 'boolean', default: true })
  activa: boolean;

  @OneToMany(() => ConversationTurn, (turn) => turn.session, { cascade: true })
  turns: ConversationTurn[];

  @Column({
    name: 'creado_en',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  creadoEn: Date;

  @Column({
    name: 'actualizado_en',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  actualizadoEn: Date;
}
