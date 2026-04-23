import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  import { Negocio } from '../../negocios/entities/negocio.entity';
  import { SucursalNegocio } from '../../sucursales_negocios/entities/sucursal-negocio.entity';
  import { LecturaEventoNegocio } from './lectura-evento-negocio.entity';
  
  @Entity('eventos_negocios')
  export class EventoNegocio {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number;
  
    @Index('idx_eventos_negocios_negocio_id')
    @Column({ name: 'negocio_id', type: 'bigint', unsigned: true })
    negocioId: number;
  
    @Index('idx_eventos_negocios_sucursal_id')
    @Column({ name: 'sucursal_id', type: 'bigint', unsigned: true, nullable: true })
    sucursalId: number | null;
  
    @Index('idx_eventos_negocios_tipo_evento')
    @Column({ name: 'tipo_evento', type: 'varchar', length: 60 })
    tipoEvento: string;
  
    @Column({ name: 'titulo', type: 'varchar', length: 180 })
    titulo: string;
  
    @Column({ name: 'descripcion', type: 'text', nullable: true })
    descripcion: string | null;
  
    @Column({ name: 'payload', type: 'json', nullable: true })
    payload: Record<string, any> | null;
  
    @Index('idx_eventos_negocios_visible_para_favoritos')
    @Column({ name: 'visible_para_favoritos', type: 'tinyint', width: 1, default: () => '1' })
    visibleParaFavoritos: boolean;
  
    @Index('idx_eventos_negocios_activo')
    @Column({ name: 'activo', type: 'tinyint', width: 1, default: () => '1' })
    activo: boolean;
  
    @Index('idx_eventos_negocios_fecha_evento')
    @Column({ name: 'fecha_evento', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    fechaEvento: Date;
  
    @CreateDateColumn({
      name: 'fecha_creacion',
      type: 'datetime',
      default: () => 'CURRENT_TIMESTAMP',
    })
    fechaCreacion: Date;
  
    @UpdateDateColumn({
      name: 'fecha_actualizacion',
      type: 'datetime',
      default: () => 'CURRENT_TIMESTAMP',
      onUpdate: 'CURRENT_TIMESTAMP',
    })
    fechaActualizacion: Date;
  
    @ManyToOne(() => Negocio, (negocio) => negocio.eventosNegocios, {
      onDelete: 'CASCADE',
      nullable: false,
    })
    @JoinColumn({ name: 'negocio_id' })
    negocio: Negocio;
  
    @ManyToOne(() => SucursalNegocio, (sucursal) => sucursal.eventosNegocios, {
      onDelete: 'SET NULL',
      nullable: true,
    })
    @JoinColumn({ name: 'sucursal_id' })
    sucursal: SucursalNegocio | null;
  
    @OneToMany(() => LecturaEventoNegocio, (lectura) => lectura.eventoNegocio)
    lecturas: LecturaEventoNegocio[];
  }