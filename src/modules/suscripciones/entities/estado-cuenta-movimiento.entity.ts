import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';

@Entity('estado_cuenta_movimientos')
@Index('idx_ecm_suscriptor', ['suscriptorId', 'fechaCreacion'])
export class EstadoCuentaMovimiento {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // FK
  @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor: Suscriptor;

  // para queries rápidas sin join
  @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
  suscriptorId: number;

  @Column({
    name: 'tipo_movimiento',
    type: 'enum',
    enum: ['cargo', 'abono', 'ajuste', 'reembolso'],
  })
  tipoMovimiento: 'cargo' | 'abono' | 'ajuste' | 'reembolso';

  @Column({ name: 'referencia_tabla', type: 'varchar', length: 50, nullable: true })
  referenciaTabla?: string;

  @Column({ name: 'referencia_id', type: 'bigint', unsigned: true, nullable: true })
  referenciaId?: number;

  @Column({ name: 'descripcion', type: 'varchar', length: 255 })
  descripcion: string;

  @Column({ name: 'cargo_centavos', type: 'int', default: 0 })
  cargoCentavos: number;

  @Column({ name: 'abono_centavos', type: 'int', default: 0 })
  abonoCentavos: number;

  @Column({ name: 'saldo_despues_centavos', type: 'int', default: 0 })
  saldoDespuesCentavos: number;

  @Column({ type: 'varchar', length: 10, default: 'MXN' })
  moneda: string;

  @Column({ name: 'fecha_creacion', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;
}