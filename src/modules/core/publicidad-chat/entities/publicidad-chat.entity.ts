import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity('publicidad_chat')
  export class PublicidadChat {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number;
  
    @Column({ name: 'negocio_id', type: 'bigint', unsigned: true, nullable: true })
    negocioId?: number;
  
    @Column({ name: 'sucursal_id', type: 'bigint', unsigned: true, nullable: true })
    sucursalId?: number;
  
    @Column({ name: 'ciudad', type: 'varchar', length: 120, nullable: true })
    ciudad?: string;
  
    @Column({ name: 'categoria_id', type: 'bigint', unsigned: true, nullable: true })
    categoriaId?: number;
  
    @Column({ name: 'subcategoria_id', type: 'bigint', unsigned: true, nullable: true })
    subcategoriaId?: number;
  
    @Column({ name: 'titulo', type: 'varchar', length: 150 })
    titulo: string;
  
    @Column({ name: 'texto_publicitario', type: 'varchar', length: 255 })
    textoPublicitario: string;
  
    @Column({ name: 'palabras_clave', type: 'varchar', length: 255, nullable: true })
    palabrasClave?: string;
  
    @Column({ name: 'url_destino', type: 'varchar', length: 255, nullable: true })
    urlDestino?: string;
  
    @Column({ name: 'fecha_inicio', type: 'datetime' })
    fechaInicio: Date;
  
    @Column({ name: 'fecha_fin', type: 'datetime' })
    fechaFin: Date;
  
    @Column({ name: 'activo', type: 'tinyint', default: 1 })
    activo: boolean;
  
    @Column({ name: 'prioridad', type: 'int', default: 1 })
    prioridad: number;
  
    @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
    fechaCreacion: Date;
  
    @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime' })
    fechaActualizacion: Date;
  }
  