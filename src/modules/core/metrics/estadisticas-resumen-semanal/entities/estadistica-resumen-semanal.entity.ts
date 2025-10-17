import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ciudad } from '../../../../catalogos/ciudades/entities/ciudades.entity';
import { Membresia } from '../../../../business/membresias/entities/membresia.entity';

@Entity('estadisticas_resumen_semanal')
export class EstadisticaResumenSemanal {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'semana_inicio', type: 'date' })
  semanaInicio: Date;

  @Column({ name: 'semana_fin', type: 'date' })
  semanaFin: Date;

  @ManyToOne(() => Ciudad, { eager: true })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad: Ciudad;

  @ManyToOne(() => Membresia, { eager: true })
  @JoinColumn({ name: 'membresia_id' })
  membresia: Membresia;

  @Column({ name: 'total_vistas', type: 'int', default: 0 })
  totalVistas: number;

  @Column({ name: 'total_clics', type: 'int', default: 0 })
  totalClics: number;

  @Column({ name: 'total_busquedas', type: 'int', default: 0 })
  totalBusquedas: number;

  @Column({ name: 'promedio_vistas', type: 'decimal', precision: 10, scale: 2, default: 0 })
  promedioVistas: number;

  @Column({ name: 'promedio_clics', type: 'decimal', precision: 10, scale: 2, default: 0 })
  promedioClics: number;

  @Column({ name: 'promedio_busquedas', type: 'decimal', precision: 10, scale: 2, default: 0 })
  promedioBusquedas: number;

  @Column({ name: 'variacion_vistas', type: 'decimal', precision: 6, scale: 2, default: 0 })
  variacionVistas: number;

  @Column({ name: 'variacion_clics', type: 'decimal', precision: 6, scale: 2, default: 0 })
  variacionClics: number;

  @Column({ name: 'variacion_busquedas', type: 'decimal', precision: 6, scale: 2, default: 0 })
  variacionBusquedas: number;

  @Column({ name: 'fecha_registro', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fechaRegistro: Date;
}
