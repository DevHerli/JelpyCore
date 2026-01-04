import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
  } from 'typeorm';
  import { SucursalNegocio } from '../../../business/sucursales_negocios/entities/sucursal-negocio.entity';
  import { Suscriptor } from '../../../business/suscriptores/entities/suscriptores.entity';
  
  @Entity('sucursal_likes')
  export class SucursalLike {
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
  
    @CreateDateColumn({ name: 'fecha_like', type: 'datetime' })
    fechaLike: Date;
  }
  