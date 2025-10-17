import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Estado } from '../../../catalogos/estados/entities/estado.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

@Entity('suscriptores')
export class Suscriptor {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @Column({ name: 'apellido_paterno', length: 100 })
  apellidoPaterno: string;

  @Column({ name: 'apellido_materno', length: 100, nullable: true })
  apellidoMaterno?: string;

  @Column({ type: 'enum', enum: ['M', 'F', 'Otro'] })
  sexo: string;

  @Column({ name: 'fecha_nacimiento', type: 'date' })
  fechaNacimiento: Date;

  @ManyToOne(() => Ciudad, { eager: true })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad: Ciudad;


  @Column({ name: 'telefono_celular', length: 20, unique: true })
  telefonoCelular: string;

  @Column({ name: 'correo_electronico', length: 150, unique: true })
  correoElectronico: string;

  @Column({ length: 255 })
  contrasena: string;

  @ManyToOne(() => Estado, { eager: true, nullable: true })
  @JoinColumn({ name: 'estado_id' })
  estado?: Estado;

  @Column({ name: 'ultimo_login', type: 'datetime', nullable: true })
  ultimoLogin?: Date;

  @Column({ name: 'fecha_registro', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fechaRegistro: Date;

  @Column({
    name: 'fecha_actualizacion',
    type: 'datetime',
    nullable: true,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion?: Date;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  eliminado: boolean;
}
