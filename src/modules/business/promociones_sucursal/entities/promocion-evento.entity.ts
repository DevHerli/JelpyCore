import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// METRICS-002: log por-evento de descubrimiento/interacción con una
// promoción (vista / conversión). Mismo patrón que SearchTrendEvent
// (search_trend_events): una fila por evento, con categoría/subcategoría/
// especialidad DESNORMALIZADAS (fotografiadas al momento del evento, porque
// la promoción no tiene esa relación directa — se hereda de
// promocion.sucursal.negocio y ese negocio puede cambiar de categoría
// después).
//
// "Alcanzados" NO es un tipo de evento: se calcula como
// COUNT(DISTINCT COALESCE(usuario_id, device_id)) sobre las filas 'vista'.
export type TipoEventoPromocion = 'vista' | 'conversion';
export type TipoConversionPromocion = 'llamada' | 'whatsapp' | 'como_llegar' | 'ver_negocio';
export type OrigenEventoPromocion = 'home' | 'chat';

@Entity('promociones_eventos')
@Index('idx_promo_eventos_promocion', ['promocionId', 'tipoEvento'])
@Index('idx_promo_eventos_sucursal', ['sucursalId', 'tipoEvento', 'fecha'])
@Index('idx_promo_eventos_negocio', ['negocioId', 'tipoEvento', 'fecha'])
@Index('idx_promo_eventos_categoria', ['categoriaId', 'fecha'])
@Index('idx_promo_eventos_subcategoria', ['subcategoriaId', 'fecha'])
@Index('idx_promo_eventos_especialidad', ['especialidadId', 'fecha'])
@Index('idx_promo_eventos_origen', ['origen', 'fecha'])
export class PromocionEvento {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'promocion_id', type: 'bigint', unsigned: true })
  promocionId: number;

  @Column({ name: 'sucursal_id', type: 'int' })
  sucursalId: number;

  @Column({ name: 'negocio_id', type: 'int' })
  negocioId: number;

  @Column({ name: 'tipo_evento', type: 'enum', enum: ['vista', 'conversion'] })
  tipoEvento: TipoEventoPromocion;

  @Column({
    name: 'tipo_conversion',
    type: 'enum',
    enum: ['llamada', 'whatsapp', 'como_llegar', 'ver_negocio'],
    nullable: true,
  })
  tipoConversion: TipoConversionPromocion | null;

  @Column({ type: 'enum', enum: ['home', 'chat'], default: 'home' })
  origen: OrigenEventoPromocion;

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

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @Column({ name: 'device_id', type: 'varchar', length: 80, nullable: true })
  deviceId: string | null;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'tinyint', unsigned: true })
  hora: number;

  @Column({ name: 'dia_semana', type: 'tinyint', unsigned: true })
  diaSemana: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
