import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';
import { Estado } from '../../../catalogos/estados/entities/estado.entity';
import { Membresia } from '../../membresias/entities/membresia.entity';
import { SucursalReview } from '../../sucursales_reviews/entities/sucursal-review.entity';
import { LecturaEventoNegocio } from '../../eventos_negocios/entities/lectura-evento-negocio.entity';

@Entity('suscriptores')
export class Suscriptor {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @OneToMany(() => SucursalReview, (r) => r.suscriptor)
reseñas: SucursalReview[];

  // --- Datos personales básicos ---
  @Column({ length: 100 })
  nombre: string;

  @Column({ name: 'apellido_paterno', length: 100 })
  apellidoPaterno: string;

  @Column({ name: 'apellido_materno', length: 100, nullable: true })
  apellidoMaterno?: string;

  @Column({
    type: 'enum',
    enum: ['M', 'F', 'Otro', 'No especifica'],
    nullable: true,
  })
  sexo?: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: Date;

  // --- Relaciones ---
  @ManyToOne(() => Ciudad, { eager: true })
  @JoinColumn({ name: 'ciudad_id' })
  ciudad: Ciudad;

  @ManyToOne(() => Estado, { eager: true, nullable: true })
  @JoinColumn({ name: 'estado_id' })
  estado?: Estado;

  @ManyToOne(() => Membresia, { eager: true, nullable: true })
  @JoinColumn({ name: 'membresia_id' })
  membresia?: Membresia;

  // --- Contacto ---
  @Column({ name: 'telefono_celular', length: 20, unique: true })
  telefonoCelular: string;

  @Column({
    name: 'correo_electronico',
    length: 150,
    unique: true,
    nullable: true,
    comment: 'Opcional pero recomendado para comunicación con el usuario',
  })
  correoElectronico?: string;

  // --- Autenticación ---
  @Column({
    length: 255,
    nullable: true,
    comment: 'Contraseña opcional, útil para acceso web o recuperación de cuenta',
  })
  contrasena?: string;

  @Column({ name: 'refresh_token', type: 'varchar', length: 500, nullable: true })
  refreshToken?: string;

  // --- Banderas y control ---
  @Column({ name: 'acepto_terminos', type: 'tinyint', width: 1, default: 0 })
  aceptoTerminos: boolean;

  @Column({
    name: 'registro_completo',
    type: 'tinyint',
    width: 1,
    default: 0,
    comment: '0 = incompleto, 1 = completo',
  })
  registroCompleto: boolean;

  @Column({
    name: 'tiene_negocios',
    type: 'tinyint',
    width: 1,
    default: 0,
    comment: '0 = sin negocios, 1 = tiene negocios',
  })
  tieneNegocios: boolean;

  // --- Auditoría ---
  @Column({ name: 'ultimo_login', type: 'datetime', nullable: true })
  ultimoLogin?: Date;

  @Column({
    name: 'fecha_registro',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
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

  // Rol del usuario — controla acceso a funciones admin
  @Column({
    type: 'enum',
    enum: ['user', 'admin', 'editor'],
    default: 'user',
  })
  role: 'user' | 'admin' | 'editor';

  @OneToMany(() => LecturaEventoNegocio, (lectura) => lectura.suscriptor)
  lecturasEventosNegocios: LecturaEventoNegocio[];
}
