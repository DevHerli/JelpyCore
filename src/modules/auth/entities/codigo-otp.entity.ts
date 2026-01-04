import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('codigos_otp')
export class CodigoOtp {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'telefono_celular', length: 20 })
  telefonoCelular: string;

  @Column({ name: 'correo_electronico', length: 190, nullable: true })
  correoElectronico?: string | null;

  @Column({ length: 6 })
  codigo: string;

  @Column({ type: 'datetime' })
  expiracion: Date;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  usado: boolean;

  // Aquí guardaremos temporalmente los datos del registro
  @Column({ name: 'datos_registro', type: 'json', nullable: true })
datosRegistro?: any;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
intentos: number;

}
