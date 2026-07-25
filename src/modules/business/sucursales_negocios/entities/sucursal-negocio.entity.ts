import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Negocio } from '../../negocios/entities/negocio.entity';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Estado } from '../../../catalogos/estados/entities/estado.entity';
import { SucursalCaracteristica } from '../../caracteristicas_sucursales/entities/sucursal-caracteristica.entity';
import { HorarioSucursal } from '../../horario_sucursal/entities/horarios-sucursal.entity';
import { SucursalImagen } from './sucursal-imagen.entity';
import { SucursalReview } from '../../sucursales_reviews/entities/sucursal-review.entity';
import { PromotionBusinessBranch } from '../../promociones_negocio/entities/promotion-business-branch.entity';
import { EventoNegocio } from '../../eventos_negocios/entities/evento-negocio.entity';

@Entity('sucursales_negocios')
export class SucursalNegocio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Negocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  @OneToMany(() => SucursalCaracteristica, (sc) => sc.sucursal)
  caracteristicas: SucursalCaracteristica[];

  @OneToMany(() => HorarioSucursal, (h) => h.sucursal, { eager: true })
  horarios: HorarioSucursal[];

  @OneToMany(() => SucursalImagen, (imagen) => imagen.sucursal, { eager: true })
  imagenes: SucursalImagen[];

  @OneToMany(() => SucursalReview, (r) => r.sucursal)
  reseñas: SucursalReview[];

  @Column({ name: 'nombre_sucursal', length: 150 })
  nombreSucursal: string;

  @Column({ length: 120 })
  calle: string;

  @Column({ name: 'numero_exterior', length: 10 })
  numeroExterior: string;

  @Column({ name: 'numero_interior', length: 10, nullable: true })
  numeroInterior?: string;

  @Column({ length: 120 })
  colonia: string;

  @Column({ name: 'entre_calle_1', length: 150, nullable: true })
  entreCalle1?: string;

  @Column({ name: 'entre_calle_2', length: 150, nullable: true })
  entreCalle2?: string;

  @Column({ name: 'codigo_postal', length: 10 })
  codigoPostal: string;

  @ManyToOne(() => Ciudad, { eager: true })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad: Ciudad;

  @ManyToOne(() => Estado, { eager: true })
  @JoinColumn({ name: 'estado_id' })
  estado: Estado;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  latitud?: number;

  @Column('decimal', { precision: 10, scale: 7, nullable: true })
  longitud?: number;

  @Column({ name: 'telefono_fijo1', length: 20, nullable: true })
  telefonoFijo1?: string;

  @Column({ name: 'telefono_fijo2', length: 20, nullable: true })
  telefonoFijo2?: string;

  @Column({ name: 'telefono_fijo3', length: 20, nullable: true })
  telefonoFijo3?: string;

  @Column({ name: 'telefono_celular1', length: 20, nullable: true })
  telefonoCelular1?: string;

  @Column({ name: 'telefono_celular2', length: 20, nullable: true })
  telefonoCelular2?: string;

  @Column({ name: 'telefono_celular3', length: 20, nullable: true })
  telefonoCelular3?: string;

  @Column({ name: 'telefono_celular4', length: 20, nullable: true })
  telefonoCelular4?: string;

  @Column({ name: 'correo_contacto', length: 150, nullable: true })
  correoContacto?: string;

  @Column({ length: 20, nullable: true })
  whatsapp?: string;

  @Column({ name: 'referencia_mapa', length: 255, nullable: true })
  referenciaMapa?: string;

  @Column({ name: 'tipo_sucursal', length: 50, nullable: true })
  tipoSucursal?: string;

  @Column({ name: 'es_matriz', type: 'tinyint', width: 1, default: 0 })
  esMatriz: boolean;

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

  @Column({ name: 'imagen_url', type: 'varchar', length: 255, nullable: true })
  imagenUrl?: string;

  @Column({ name: 'rango_precios', type: 'tinyint', nullable: true, default: null })
  rangoPrecios?: number | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  eliminado: boolean;

  @OneToMany(() => PromotionBusinessBranch, (x) => x.sucursal)
  promocionesGlobalesLinks?: PromotionBusinessBranch[];

  @OneToMany(() => EventoNegocio, (evento) => evento.sucursal)
  eventosNegocios: EventoNegocio[];
}