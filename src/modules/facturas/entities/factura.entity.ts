import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';
import { Pago } from '../../pagos/entities/pago.entity';

@Entity('facturas')
@Index('idx_facturas_suscriptor', ['suscriptorId'])
export class Factura {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
  suscriptorId: number;

  @ManyToOne(() => Pago, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pago_id' })
  pago?: Pago;

  @Column({ name: 'pago_id', type: 'bigint', unsigned: true, nullable: true })
  pagoId?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  folio?: string;

  @CreateDateColumn({ name: 'fecha', type: 'datetime' })
  fecha: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  concepto?: string;

  @Column({ name: 'total_centavos', type: 'int', default: 0 })
  totalCentavos: number;

  @Column({
    type: 'enum',
    enum: ['pendiente', 'emitida', 'cancelada'],
    default: 'pendiente',
  })
  estatus: 'pendiente' | 'emitida' | 'cancelada';

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string;

  @Column({ name: 'xml_url', type: 'varchar', length: 500, nullable: true })
  xmlUrl?: string;

  @Column({ name: 'uuid_cfdi', type: 'varchar', length: 50, nullable: true })
  uuidCfdi?: string;

  // Snapshot de datos fiscales al momento de emitir
  @Column({ type: 'varchar', length: 13, nullable: true })
  rfc?: string;

  @Column({ name: 'razon_social', type: 'varchar', length: 150, nullable: true })
  razonSocial?: string;
}
