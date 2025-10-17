import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('estados')
export class Estado {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ length: 255, nullable: true })
  descripcion?: string;

  @Column({
    type: 'enum',
    enum: ['general', 'suscriptor', 'negocio', 'promocion', 'membresia'],
    default: 'general',
  })
  tipo: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion: Date;
}
