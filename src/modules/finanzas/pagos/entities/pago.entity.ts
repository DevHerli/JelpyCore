import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
  } from 'typeorm';
  import { Negocio } from '../../../business/negocios/entities/negocio.entity';
  import { Suscriptor } from '../../../business/suscriptores/entities/suscriptores.entity';
  import { Membresia } from '../../../business/membresias/entities/membresia.entity';
  
  @Entity('pagos')
  export class Pago {
    @PrimaryGeneratedColumn()
    id: number;
  
    @ManyToOne(() => Negocio)
    @JoinColumn({ name: 'negocio_id' })
    negocio: Negocio;
  
    @ManyToOne(() => Suscriptor)
    @JoinColumn({ name: 'suscriptor_id' })
    suscriptor: Suscriptor;
  
    @ManyToOne(() => Membresia)
    @JoinColumn({ name: 'membresia_id' })
    membresia: Membresia;
  
    @Column({ type: 'decimal', precision: 10, scale: 2 })
    monto: number;
  
    @Column({
      name: 'metodo_pago',
      type: 'enum',
      enum: ['stripe', 'conekta', 'transferencia', 'oxxo', 'paypal'],
      default: 'stripe',
    })
    metodoPago: string;
  
    @Column({
      type: 'enum',
      enum: ['pendiente', 'procesando', 'pagado', 'fallido', 'reembolsado'],
      default: 'pendiente',
    })
    estatus: string;
  
    @Column({ name: 'referencia_externa', type: 'varchar', length: 255, nullable: true })
    referenciaExterna?: string;
  
    @Column({ name: 'comprobante_url', type: 'varchar', length: 500, nullable: true })
    comprobanteUrl?: string;
  
    @CreateDateColumn({ name: 'fecha_creacion' })
    fechaCreacion: Date;
  
    @UpdateDateColumn({ name: 'fecha_actualizacion', nullable: true })
    fechaActualizacion?: Date;
  }
  