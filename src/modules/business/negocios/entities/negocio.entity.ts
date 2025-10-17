import { Categoria } from '../../../catalogos/categorias/entities/categorias.entity';
import { Subcategoria } from '../../../catalogos/subcategorias/entities/subcategorias.entity';
import { Especialidad } from '../../../catalogos/especialidades/entities/especialidades.entity';
import { Suscriptor } from '../../suscriptores/entities/suscriptores.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Membresia } from '../../membresias/entities/membresia.entity';
import { Estado } from '../../../catalogos/estados/entities/estado.entity';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';

@Entity('negocios')
export class Negocio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  @Column({ name: 'nombre_negocio', length: 150 })
  nombreNegocio: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({ name: 'logo_url', length: 255, nullable: true })
  logoUrl?: string;

  @ManyToOne(() => Ciudad, { eager: true })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad: Ciudad;

  @ManyToOne(() => Categoria)
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  @ManyToOne(() => Subcategoria, { nullable: true })
  @JoinColumn({ name: 'subcategoria_id' })
  subcategoria?: Subcategoria;

  @ManyToOne(() => Especialidad, { nullable: true })
  @JoinColumn({ name: 'especialidad_id' })
  especialidad?: Especialidad;

 @ManyToOne(() => Membresia, { eager: true })
@JoinColumn({ name: 'membresia_id' })
membresia: Membresia;

@ManyToOne(() => Estado, { eager: true })
@JoinColumn({ name: 'estado_id' })
estado: Estado;


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

@OneToMany(() => SucursalNegocio, (sucursal) => sucursal.negocio, { eager: true })
sucursales: SucursalNegocio[];
}
