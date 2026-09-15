import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Suscriptor } from '../../suscriptores/entities/suscriptores.entity';
import { PromocionSucursal } from '../../promociones_sucursal/entities/promocion-sucursal.entity';

/**
 * Favorito de PROMOCIÓN (distinto de `Bookmark`, que guarda SUCURSALES).
 * Mismo patrón que bookmark_branch/entities/bookmark.entity.ts: una fila por
 * (suscriptor, promoción), UNIQUE para que "toggle" no cree duplicados.
 */
@Entity('promociones_favoritos')
@Unique(['suscriptor', 'promocion'])
export class PromocionFavorito {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Suscriptor, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  @ManyToOne(() => PromocionSucursal, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promocion_id' })
  promocion: PromocionSucursal;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
