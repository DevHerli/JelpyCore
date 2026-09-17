import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * RefreshSession — JLP-020 (multi-dispositivo)
 *
 * Antes, `Suscriptor.refreshToken` guardaba UN SOLO hash de refresh token por
 * usuario. Iniciar sesión en un segundo dispositivo (p. ej. celular + web, o
 * reinstalar la app en el simulador durante pruebas) sobrescribía ese hash;
 * el primer dispositivo, al intentar renovar con su token ahora obsoleto,
 * disparaba la detección de reuso (JLP-001) y quedaba deslogueado sin motivo
 * aparente — el famoso "cierra sesión solo".
 *
 * Esta tabla reemplaza esa columna única por una fila POR SESIÓN (por
 * dispositivo/cliente). El refresh JWT ahora incluye un `jti` (session id)
 * que identifica exactamente qué fila validar/rotar/revocar, así un reuso
 * detectado en un dispositivo ya NO afecta la sesión de los demás.
 *
 * `Suscriptor.refreshToken` se deja intacta (sin usarse) para no requerir un
 * cambio destructivo de esquema; simplemente deja de escribirse.
 */
@Entity('refresh_sessions')
export class RefreshSession {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
  suscriptorId: number;

  /** Session id embebido en el claim `jti` del refresh JWT. Único por fila. */
  @Column({ length: 36, unique: true })
  jti: string;

  /** Hash bcrypt del refresh token vigente para esta sesión. */
  @Column({ name: 'token_hash', length: 255, select: false })
  tokenHash: string;

  /** Informativo — para una futura pantalla "Sesiones activas". No crítico. */
  @Column({ name: 'user_agent', length: 255, nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt?: Date | null;

  /** NULL = sesión activa. Se marca al hacer logout, cambiar contraseña,
   *  eliminar cuenta, o al detectar reuso de un token ya rotado. */
  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;
}
