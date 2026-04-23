import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
  } from 'typeorm';
  
  import { EventoNegocio } from './evento-negocio.entity';
  import { Suscriptor } from '../../suscriptores/entities/suscriptores.entity';
  
  @Entity('lecturas_eventos_negocios')
  @Unique('uk_lecturas_eventos_negocios_evento_suscriptor', ['eventoNegocioId', 'suscriptorId'])
  export class LecturaEventoNegocio {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number;
  
    @Index('idx_lecturas_eventos_negocios_evento_negocio_id')
    @Column({ name: 'evento_negocio_id', type: 'bigint', unsigned: true })
    eventoNegocioId: number;
  
    @Index('idx_lecturas_eventos_negocios_suscriptor_id')
    @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
    suscriptorId: number;
  
    @Index('idx_lecturas_eventos_negocios_fecha_lectura')
    @Column({ name: 'fecha_lectura', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    fechaLectura: Date;
  
    @CreateDateColumn({
      name: 'fecha_creacion',
      type: 'datetime',
      default: () => 'CURRENT_TIMESTAMP',
    })
    fechaCreacion: Date;
  
    @ManyToOne(() => EventoNegocio, (evento) => evento.lecturas, {
      onDelete: 'CASCADE',
      nullable: false,
    })
    @JoinColumn({ name: 'evento_negocio_id' })
    eventoNegocio: EventoNegocio;
  
    @ManyToOne(() => Suscriptor, (suscriptor) => suscriptor.lecturasEventosNegocios, {
      onDelete: 'CASCADE',
      nullable: false,
    })
    @JoinColumn({ name: 'suscriptor_id' })
    suscriptor: Suscriptor;
  }