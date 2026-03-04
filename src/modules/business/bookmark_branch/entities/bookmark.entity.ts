import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Suscriptor } from '../../suscriptores/entities/suscriptores.entity';
import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';

@Entity('bookmarks')
@Unique(['suscriptor', 'sucursal'])
export class Bookmark {

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  @ManyToOne(() => SucursalNegocio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
