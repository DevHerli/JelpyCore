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

  // nullable:false — ambas son NOT NULL y además forman el UNIQUE de la tabla.
  // Si TypeORM las cree opcionales, un NULL rompe la unicidad (en SQL NULL no
  // colisiona con NULL) y se pueden colar favoritos duplicados.
  @ManyToOne(() => Suscriptor, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  @ManyToOne(() => SucursalNegocio, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sucursal_id' })
  sucursal: SucursalNegocio;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;
}
