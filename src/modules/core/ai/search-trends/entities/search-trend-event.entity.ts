import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('search_trend_events')
@Index('idx_search_trends_fecha_ciudad', ['fecha', 'ciudad'])
@Index('idx_search_trends_categoria_fecha', ['categoriaId', 'fecha'])
@Index('idx_search_trends_subcategoria_fecha', ['subcategoriaId', 'fecha'])
@Index('idx_search_trends_especialidad_fecha', ['especialidadId', 'fecha'])
@Index('idx_search_trends_ciudad_categoria_fecha', ['ciudad', 'categoriaId', 'fecha'])
@Index('idx_search_trends_hora_fecha', ['hora', 'fecha'])
export class SearchTrendEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @Column({ name: 'session_id', type: 'varchar', length: 80, nullable: true })
  sessionId: string | null;

  @Column({ name: 'query_original', type: 'varchar', length: 500 })
  queryOriginal: string;

  @Column({ name: 'query_normalizada', type: 'varchar', length: 500, nullable: true })
  queryNormalizada: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  ciudad: string | null;

  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @Column({ name: 'subcategoria_id', type: 'int', nullable: true })
  subcategoriaId: number | null;

  @Column({ name: 'especialidad_id', type: 'int', nullable: true })
  especialidadId: number | null;

  @Column({ name: 'categoria_nombre', type: 'varchar', length: 160, nullable: true })
  categoriaNombre: string | null;

  @Column({ name: 'subcategoria_nombre', type: 'varchar', length: 160, nullable: true })
  subcategoriaNombre: string | null;

  @Column({ name: 'especialidad_nombre', type: 'varchar', length: 160, nullable: true })
  especialidadNombre: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  intent: string | null;

  @Column({ name: 'total_resultados', type: 'int', default: 0 })
  totalResultados: number;

  @Column({ name: 'sin_resultados', type: 'boolean', default: false })
  sinResultados: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number | null;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'tinyint', unsigned: true })
  hora: number;

  @Column({ name: 'dia_semana', type: 'tinyint', unsigned: true })
  diaSemana: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
