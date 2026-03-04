import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Negocio } from '../../negocios/entities/negocio.entity'; // Ajusta la ruta si es necesario

@Entity('categorias_catalogo')
export class CategoriaCatalogo {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'negocio_id', type: 'bigint', unsigned: true })
  negocioId: number;

  @Column()
  nombre: string;

  @Column({ default: true })
  activo: boolean;

  @ManyToOne(() => Negocio)
  @JoinColumn({ name: 'negocio_id' })
  negocio: Negocio;
}