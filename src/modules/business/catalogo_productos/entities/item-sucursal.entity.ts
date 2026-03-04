import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity'; // Ajusta ruta
import { ItemNegocio } from './item-negocio.entity';

@Entity('items_sucursal')
export class ItemSucursal {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'sucursal_id', type: 'bigint', unsigned: true })
  sucursalId: number;

  @Column({ name: 'item_negocio_id', type: 'bigint', unsigned: true })
  itemNegocioId: number;

  @Column({ name: 'precio_especifico', type: 'decimal', precision: 10, scale: 2, nullable: true })
  precioEspecifico: number; // Si es null, usa precioBase

  @Column({ default: true })
  disponible: boolean;

  @ManyToOne(() => SucursalNegocio)
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  @ManyToOne(() => ItemNegocio)
  @JoinColumn({ name: 'item_negocio_id' })
  itemNegocio: ItemNegocio;
}