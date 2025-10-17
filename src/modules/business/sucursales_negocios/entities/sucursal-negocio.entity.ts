import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Negocio } from '../../negocios/entities/negocio.entity';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Estado } from '../../../catalogos/estados/entities/estado.entity';

@Entity('sucursales_negocios')
export class SucursalNegocio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // Negocio
  @ManyToOne(() => Negocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

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

  @Column({ name: 'entre_calles', length: 255, nullable: true })
  entreCalles?: string;

  @Column({ name: 'codigo_postal', length: 10 })
  codigoPostal: string;

  // Ciudad y Estado (catálogos)
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

  @Column({ type: 'tinyint', width: 1, default: 0 })
  eliminado: boolean;
}
