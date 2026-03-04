import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Negocio } from '../../negocios/entities/negocio.entity';
import { CategoriaCatalogo } from './categoria-catalogo.entity';
import { ItemSucursal } from './item-sucursal.entity';

@Entity('items_negocio')
export class ItemNegocio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'negocio_id', type: 'bigint', unsigned: true })
  negocioId: number;

  @Column({ name: 'categoria_id', type: 'bigint', unsigned: true, nullable: true })
  categoriaId: number;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ name: 'precio_base', type: 'decimal', precision: 10, scale: 2 })
  precioBase: number;

  @Column({ type: 'enum', enum: ['producto', 'servicio'], default: 'producto' })
  tipo: 'producto' | 'servicio';

  @Column({ name: 'duracion_minutos', nullable: true })
  duracionMinutos: number;

  @Column({ name: 'imagen_url', nullable: true })
  imagenUrl: string;

  @Column({ default: true })
  activo: boolean;

  @ManyToOne(() => Negocio)
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;

  @ManyToOne(() => CategoriaCatalogo)
  @JoinColumn({ name: 'categoria_id' })
  categoria: CategoriaCatalogo;

  @OneToMany(() => ItemSucursal, (is) => is.itemNegocio)
  disponibilidad: ItemSucursal[];
}