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
import { Pago } from '../../pagos/entities/pago.entity';
import { PerfilFacturacion } from './perfil-facturacion.entity';

export type EstatusFactura = 'borrador' | 'emitida' | 'cancelada';

/**
 * CFDI emitido (o por emitir) a un suscriptor.
 *
 * ── POR QUÉ SE REESCRIBIÓ ESTA ENTITY ──────────────────────────────────────
 * La versión anterior describía una tabla que no existe. Contra la BD real de
 * producción, cualquier consulta moría con:
 *
 *   [ER_BAD_FIELD_ERROR] Unknown column 'Factura.fecha' in 'SELECT'
 *
 * lo que dejaba caídas las 6 rutas de /facturas. Divergencias que había:
 *
 *   entity (antes)        tabla real
 *   ---------------------------------------------------------------
 *   fecha                 fecha_creacion / fecha_emision (son distintas)
 *   concepto              (no existe)
 *   uuid_cfdi             uuid
 *   rfc, razon_social     (normalizados en perfiles_facturacion)
 *   (no mapeaba)          perfil_facturacion_id  NOT NULL + FK
 *   (no mapeaba)          subtotal_centavos      NOT NULL
 *   (no mapeaba)          impuestos_centavos, moneda, proveedor_cfdi
 *   estatus 'pendiente'   ENUM('borrador','emitida','cancelada')
 *
 * Se adaptó la entity a la tabla y no al revés: el esquema de la BD es el
 * correcto —desglosa subtotal/impuestos (obligatorio en un CFDI), guarda todo
 * en centavos (enteros, sin errores de redondeo en dinero), lleva moneda, y
 * normaliza los datos fiscales del receptor en su propia tabla—. Migrar la
 * tabla al modelo viejo habría sido perder todo eso.
 *
 * ── FECHAS: SON DOS, Y NO SIGNIFICAN LO MISMO ─────────────────────────────
 *   fechaCreacion → cuándo se registró la solicitud en Jelpy.
 *   fechaEmision  → cuándo se timbró ante el SAT (NULL mientras sea borrador).
 * La entity anterior las colapsaba en un solo campo `fecha`.
 */
@Entity('facturas')
@Index('idx_fact_suscriptor', ['suscriptorId', 'fechaCreacion'])
export class Factura {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  // ── Receptor ──────────────────────────────────────────────────────────────

  @ManyToOne(() => Suscriptor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suscriptor_id' })
  suscriptor?: Suscriptor;

  @Column({ name: 'suscriptor_id', type: 'bigint', unsigned: true })
  suscriptorId: number;

  /**
   * NOT NULL en la BD. Es el motivo por el que ningún INSERT funcionaba: la
   * entity no lo mapeaba, así que TypeORM nunca lo enviaba.
   */
  @ManyToOne(() => PerfilFacturacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'perfil_facturacion_id' })
  perfilFacturacion?: PerfilFacturacion;

  @Column({ name: 'perfil_facturacion_id', type: 'bigint', unsigned: true })
  perfilFacturacionId: number;

  // ── Pago que origina la factura (opcional) ────────────────────────────────

  @ManyToOne(() => Pago, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pago_id' })
  pago?: Pago | null;

  @Column({ name: 'pago_id', type: 'bigint', unsigned: true, nullable: true })
  pagoId?: number | null;

  // ── Estado ────────────────────────────────────────────────────────────────

  /**
   * 'borrador' = registrada en Jelpy, aún sin timbrar.
   * 'emitida'  = timbrada por el PAC, ya tiene uuid/folio/xml/pdf.
   * 'cancelada'= cancelada ante el SAT.
   *
   * La entity anterior usaba 'pendiente', valor que este ENUM no acepta:
   * guardarlo fallaba con ER_TRUNCATED_WRONG_VALUE (1265).
   */
  @Column({
    type: 'enum',
    enum: ['borrador', 'emitida', 'cancelada'],
    default: 'borrador',
  })
  estatus: EstatusFactura;

  // ── Importes (SIEMPRE en centavos, enteros) ───────────────────────────────
  // Se usan enteros y no decimales para que no exista redondeo binario en
  // dinero. total = subtotal + impuestos, y esa igualdad debe cumplirse
  // siempre porque el CFDI la valida.

  @Column({ name: 'subtotal_centavos', type: 'int' })
  subtotalCentavos: number;

  @Column({ name: 'impuestos_centavos', type: 'int', default: 0 })
  impuestosCentavos: number;

  @Column({ name: 'total_centavos', type: 'int' })
  totalCentavos: number;

  @Column({ type: 'varchar', length: 10, default: 'MXN' })
  moneda: string;

  // ── Datos del timbrado (se llenan al emitir) ──────────────────────────────

  /** PAC que timbró: 'facturapi', 'finkok', etc. */
  @Column({ name: 'proveedor_cfdi', type: 'varchar', length: 50, nullable: true })
  proveedorCfdi?: string | null;

  /** Folio fiscal (UUID) que devuelve el SAT al timbrar. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  uuid?: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  folio?: string | null;

  @Column({ name: 'xml_url', type: 'varchar', length: 255, nullable: true })
  xmlUrl?: string | null;

  @Column({ name: 'pdf_url', type: 'varchar', length: 255, nullable: true })
  pdfUrl?: string | null;

  /** Fecha del timbrado ante el SAT. NULL mientras esté en borrador. */
  @Column({ name: 'fecha_emision', type: 'datetime', nullable: true })
  fechaEmision?: Date | null;

  // ── Auditoría ─────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'fecha_creacion', type: 'datetime' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'datetime', nullable: true })
  fechaActualizacion?: Date;
}
