import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { SucursalNegocio } from '../../../business/sucursales_negocios/entities/sucursal-negocio.entity';
  import { Suscriptor } from '../../../business/suscriptores/entities/suscriptores.entity';
  
  @Entity('reseñas_sucursal')
  export class ResenaSucursal {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number;
  
    @ManyToOne(() => SucursalNegocio, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'sucursal_id' })
    sucursal: SucursalNegocio;
  
    @Column({ name: 'sucursal_id', type: 'bigint', unsigned: true })
    sucursalId: number;
  
    @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'usuario_id' })
    usuario: Suscriptor;
  
    @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
    usuarioId: number;
  
    @Column({ name: 'calificacion', type: 'tinyint', unsigned: true })
    calificacion: number; // 1..5
  
    @Column({ name: 'comentario', type: 'varchar', length: 500, nullable: true })
    comentario?: string;
  
    @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
    fechaCreacion: Date;
  
    @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
    fechaActualizacion?: Date;
  }
  