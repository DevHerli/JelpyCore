import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { Suscriptor } from '../../../business/suscriptores/entities/suscriptores.entity';
  import { Categoria } from '../../../catalogos/categorias/entities/categorias.entity';
  import { Subcategoria } from '../../../catalogos/subcategorias/entities/subcategorias.entity';
  
  @Entity('usuario_preferencias')
  export class UsuarioPreferencia {
    @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
    id: number;
  
    @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'usuario_id' })
    usuario: Suscriptor;
  
    @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
    usuarioId: number;
  
    @ManyToOne(() => Categoria, { nullable: true })
    @JoinColumn({ name: 'categoria_id' })
    categoria?: Categoria;
  
    @Column({ name: 'categoria_id', type: 'bigint', unsigned: true, nullable: true })
    categoriaId?: number;
  
    @ManyToOne(() => Subcategoria, { nullable: true })
    @JoinColumn({ name: 'subcategoria_id' })
    subcategoria?: Subcategoria;
  
    @Column({ name: 'subcategoria_id', type: 'bigint', unsigned: true, nullable: true })
    subcategoriaId?: number;
  
    @Column({ type: 'int', default: 1 })
    total_busquedas: number;
  
    @CreateDateColumn({ name: 'ultima_busqueda', type: 'datetime' })
    ultima_busqueda: Date;
  }
  