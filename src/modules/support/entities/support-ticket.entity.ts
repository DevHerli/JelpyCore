import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TipoTicket     = 'reporte_bug' | 'solicitud_negocio';
export type PrioridadTicket = 'normal' | 'urgente';
export type EstadoTicket    = 'pendiente' | 'en_atencion' | 'resuelto' | 'cerrado';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // Folio único generado por el backend: JLP-XXXXXX
  @Column({ type: 'varchar', length: 20, unique: true })
  folio: string;

  @Column({
    type: 'enum',
    enum: ['reporte_bug', 'solicitud_negocio'],
  })
  tipo: TipoTicket;

  // FK → suscriptores.id  (null si usuario no autenticado)
  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true, nullable: true })
  usuarioId: number | null;

  // FK → negocios.id  (solo para solicitud_negocio)
  @Column({ name: 'negocio_id', type: 'bigint', unsigned: true, nullable: true })
  negocioId: number | null;

  // Categoría — se guarda valor y etiqueta para no depender de catálogos
  @Column({ type: 'varchar', length: 60 })
  categoria: string;

  @Column({ name: 'categoria_label', type: 'varchar', length: 120 })
  categoriaLabel: string;

  // Problema — ídem
  @Column({ type: 'varchar', length: 100 })
  problema: string;

  @Column({ name: 'problema_label', type: 'varchar', length: 200 })
  problemaLabel: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({
    type: 'enum',
    enum: ['normal', 'urgente'],
    default: 'normal',
  })
  prioridad: PrioridadTicket;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'en_atencion', 'resuelto', 'cerrado'],
    default: 'pendiente',
  })
  estado: EstadoTicket;

  // Gestión interna — solo visible desde el panel admin
  @Column({ name: 'agente_id', type: 'bigint', unsigned: true, nullable: true })
  agenteId: number | null;

  @Column({ name: 'notas_internas', type: 'text', nullable: true })
  notasInternas: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  // Se llena automáticamente al cambiar estado → 'resuelto' / 'cerrado'
  @Column({ name: 'resuelto_at', type: 'datetime', nullable: true })
  resueltoAt: Date | null;

  @Column({ name: 'cerrado_at', type: 'datetime', nullable: true })
  cerradoAt: Date | null;
}
