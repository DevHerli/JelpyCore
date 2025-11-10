import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('estados')
export class Estado {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion?: string;

  @Column({
    type: 'enum',
    enum: [
      'general',
      'suscriptor',
      'negocio',
      'promocion',
      'membresia',
      'promociones',
      'anuncios',
      'sucursales',
    ],
    default: 'general',
  })
  tipo: string;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion',
    type: 'datetime',
    nullable: true,
  })
  fechaActualizacion?: Date;

  // 👇 Campos de auditoría (asegúrate que estén presentes)
  @Column({
    name: 'creado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: 'ID del usuario en jelpy_operations.usuarios_admin',
  })
  creadoPor?: number | null;

  @Column({
    name: 'actualizado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: 'ID del usuario en jelpy_operations.usuarios_admin',
  })
  actualizadoPor?: number | null;

  @Column({
    name: 'eliminado_por',
    type: 'bigint',
    unsigned: true,
    nullable: true,
    comment: 'ID del usuario en jelpy_operations.usuarios_admin',
  })
  eliminadoPor?: number | null;
}
