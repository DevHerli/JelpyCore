import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SucursalNegocio } from './sucursal-negocio.entity'; // Asegúrate que el path sea correcto

@Entity('sucursales_imagenes')
export class SucursalImagen {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'url', length: 500 })
  url: string;

  @Column({ name: 'public_id', length: 255 })
  publicId: string;

  @Column({ type: 'int', default: 0 })
  orden: number;

  @Column({ name: 'fecha_registro', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fechaRegistro: Date;

  // Relación Muchos a Uno: Muchas imágenes pertenecen a una sucursal.
  // nullable:false — `sucursal_id` es NOT NULL; una imagen sin sucursal no
  // tiene dónde mostrarse.
  @ManyToOne(() => SucursalNegocio, (sucursal) => sucursal.imagenes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  
}