import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';

/**
 * Perfil de facturación (receptor del CFDI).
 *
 * La tabla `perfiles_facturacion` ya existía en producción pero NINGUNA entity
 * la mapeaba. Como `facturas.perfil_facturacion_id` es NOT NULL con FK a esta
 * tabla, era imposible insertar una factura desde la app: de ahí que
 * `facturas` tenga 0 filas.
 *
 * Todos los campos NOT NULL de aquí son los que el SAT exige como datos del
 * receptor en CFDI 4.0 (RFC, nombre/razón social, régimen fiscal, uso del CFDI
 * y código postal del domicilio fiscal). No son opcionales: un timbrado sin
 * ellos lo rechaza el PAC.
 *
 * Relación 1-a-1 con suscriptor (UNIQUE `uq_pf_suscriptor` en la BD).
 *
 * NOTA sobre la duplicidad con `suscriptores.rfc`, `razon_social`, etc.:
 * esas columnas son las que el usuario edita hoy vía
 * `PATCH /suscriptores/:id/datos-fiscales` y son la fuente de verdad editable.
 * Este perfil es el SNAPSHOT normalizado que la factura referencia, y se
 * sincroniza desde aquéllas al solicitar una factura
 * (ver FacturasService.resolverPerfilFacturacion).
 */
@Entity('perfiles_facturacion')
@Index('uq_pf_suscriptor', ['suscriptorId'], { unique: true })
export class PerfilFacturacion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor?: Suscriptor;

  @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
  suscriptorId: number;

  @Column({ type: 'varchar', length: 13 })
  rfc: string;

  @Column({ name: 'razon_social', type: 'varchar', length: 180 })
  razonSocial: string;

  /** Clave del catálogo c_RegimenFiscal del SAT (p. ej. '601', '626'). */
  @Column({ name: 'regimen_fiscal', type: 'varchar', length: 10 })
  regimenFiscal: string;

  /** Clave del catálogo c_UsoCFDI del SAT (p. ej. 'G03', 'S01'). */
  @Column({ name: 'uso_cfdi', type: 'varchar', length: 10 })
  usoCfdi: string;

  /** CP del domicilio fiscal del receptor. Debe coincidir con la Constancia. */
  @Column({ name: 'codigo_postal', type: 'varchar', length: 10 })
  codigoPostal: string;

  @Column({ name: 'email_facturacion', type: 'varchar', length: 120 })
  emailFacturacion: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono?: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;
}
