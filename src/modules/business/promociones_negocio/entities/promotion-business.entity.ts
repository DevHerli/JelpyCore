import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany, Index
} from 'typeorm';
import { PromotionBusinessBranch } from './promotion-business-branch.entity';

@Entity('promociones_negocios')
export class PromotionBusiness {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ type: 'bigint', unsigned: true, name: 'negocio_id' })
  businessId: number;

  @Column({ type: 'varchar', length: 150 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({
    type: 'enum',
    enum: ['Descuento', '2x1', 'Promo', 'Gratis', 'Regalo', 'Cortesía', 'Otro'],
    default: 'Descuento',
    name: 'tipo_promocion',
  })
  tipoPromocion: 'Descuento' | '2x1' | 'Promo' | 'Gratis' | 'Regalo' | 'Cortesía' | 'Otro';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'valor_descuento' })
  valorDescuento?: number;

  @Column({ type: 'date', name: 'fecha_inicio' })
  fechaInicio: string;

  @Column({ type: 'date', name: 'fecha_fin' })
  fechaFin: string;

  @Column({
    type: 'set',
    enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
    nullable: true,
    name: 'dias_vigencia',
  })
  diasVigencia?: string[];

  @Column({ type: 'time', nullable: true, name: 'hora_inicio' })
  horaInicio?: string;

  @Column({ type: 'time', nullable: true, name: 'hora_fin' })
  horaFin?: string;

  @Column({ type: 'text', nullable: true })
  condiciones?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'imagen_url' })
  imagenUrl?: string;

  @Column({ type: 'tinyint', width: 1, default: 0, name: 'aplica_todas_sucursales' })
  aplicaTodasSucursales: boolean;

  @Index()
  @Column({ type: 'tinyint', width: 1, default: 1 })
  activa: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', name: 'fecha_registro' })
  fechaRegistro: string;

  @Column({ type: 'datetime', nullable: true, onUpdate: 'CURRENT_TIMESTAMP', name: 'fecha_actualizacion' })
  fechaActualizacion?: string;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  eliminado: boolean;

  // a tabla puente, no a PromocionSucursal
  @OneToMany(() => PromotionBusinessBranch, (x) => x.promotion, { cascade: true })
  branches?: PromotionBusinessBranch[];
}