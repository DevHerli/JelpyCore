import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('keywords_taxonomia')
export class KeywordTaxonomia {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    type: 'enum',
    enum: ['categoria', 'subcategoria', 'especialidad'],
  })
  tipo: 'categoria' | 'subcategoria' | 'especialidad';

  @Column({ name: 'referencia_id', type: 'bigint', unsigned: true })
  referenciaId: number;

  @Index('idx_keyword')
  @Column({ length: 100 })
  keyword: string;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  relevancia: number;

  @Column({ length: 10, default: 'es' })
  idioma: string;

  @CreateDateColumn({ name: 'fecha_registro', type: 'datetime' })
  fechaRegistro: Date;
}
