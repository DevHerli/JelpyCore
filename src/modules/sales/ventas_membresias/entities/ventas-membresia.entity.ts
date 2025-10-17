import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Suscriptor } from '../../..//business/suscriptores/entities/suscriptores.entity';
import { Negocio } from '../../..//business/negocios/entities/negocio.entity';
import { Membresia } from '../../..//business/membresias/entities/membresia.entity';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';

@Entity('ventas_membresias')
export class VentaMembresia {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Suscriptor, { eager: true })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  @ManyToOne(() => Negocio, { nullable: true })
  @JoinColumn({ name: 'negocio_id' })
  negocio?: Negocio;

  @ManyToOne(() => Membresia, { eager: true })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  @ManyToOne(() => Ciudad, { nullable: true })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad?: Ciudad;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @Column({ name: 'metodo_pago', length: 50, default: 'tarjeta' })
  metodoPago: string;

  @Column({ name: 'estatus', length: 50, default: 'pagado' })
  estatus: string;

  @Column({ name: 'fecha_compra', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fechaCompra: Date;

  @Column({ name: 'fecha_expiracion', type: 'datetime', nullable: true })
  fechaExpiracion?: Date | null;
}
