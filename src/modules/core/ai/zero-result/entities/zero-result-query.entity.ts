import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('zero_result_queries')
export class ZeroResultQuery {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  query: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  ciudad: string | null;

  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @Column({ name: 'subcategoria_id', type: 'int', nullable: true })
  subcategoriaId: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  intent: string | null;

  @Index()
  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
