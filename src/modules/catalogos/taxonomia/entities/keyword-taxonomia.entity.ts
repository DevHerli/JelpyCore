import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'keywords_taxonomia' })
export class KeywordTaxonomia {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'enum', enum: ['categoria','subcategoria','especialidad'] })
  tipo: 'categoria' | 'subcategoria' | 'especialidad';

  @Column({ type: 'bigint', unsigned: true })
  @Index()
  referencia_id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  keyword: string;

  @Column({ type: 'tinyint', unsigned: true, default: 1 })
  relevancia: number;

  @Column({ type: 'varchar', length: 10, default: 'es' })
  @Index()
  idioma: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fecha_registro: Date;
}
