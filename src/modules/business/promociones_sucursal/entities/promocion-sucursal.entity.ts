import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';

@Entity('promociones_sucursales')
export class PromocionSucursal {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // 🔗 Relación con sucursal
  @ManyToOne(() => SucursalNegocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  // 📋 Información principal
  @Column({ length: 150 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({
    name: 'tipo_promocion',
    type: 'enum',
    enum: ['Descuento', '2x1', 'Regalo', 'Cortesía', 'Otro'],
    default: 'Descuento',
  })
  tipoPromocion: string;

  @Column({
    name: 'valor_descuento',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  valorDescuento?: number;

  // 📅 Fechas y días
  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fechaFin: string;

  @Column({
    name: 'dias_vigencia',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  diasVigencia: string | null;

  // ⏰ Horarios opcionales
  @Column({ name: 'hora_inicio', type: 'time', nullable: true })
  horaInicio?: string;

  @Column({ name: 'hora_fin', type: 'time', nullable: true })
  horaFin?: string;

  // 📄 Detalles y recursos
  @Column({ type: 'text', nullable: true })
  condiciones?: string;

  @Column({ name: 'imagen_url', length: 255, nullable: true })
  imagenUrl?: string;

  // ⚙️ Estado y control
  @Column({ type: 'tinyint', width: 1, default: 1 })
  activa: boolean;

  @Column({
    name: 'fecha_registro',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaRegistro: Date;

  @Column({
    name: 'fecha_actualizacion',
    type: 'datetime',
    nullable: true,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion?: Date;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  eliminado: boolean;
}
