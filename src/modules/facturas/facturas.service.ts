import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Factura } from './entities/factura.entity';
import { PerfilFacturacion } from './entities/perfil-facturacion.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Pago } from '../pagos/entities/pago.entity';
import { SolicitarFacturaDto } from './dtos/solicitar-factura.dto';

/** Identidad del solicitante para verificación de propiedad (JLP-H14). */
export type RequesterCtx = { sub: number; isAdmin: boolean };

/**
 * IVA general vigente en México.
 *
 * SUPUESTO DE NEGOCIO — los precios de los planes ($199 / $399 / $699 MXN) se
 * tratan como IVA INCLUIDO, que es lo que se le cobra al usuario en Stripe y
 * lo que se le muestra en el portal. Por eso el total es el dato de entrada y
 * el subtotal se deriva hacia atrás, no al revés.
 *
 * Si el negocio decidiera que esos precios son + IVA, hay que cambiar aquí Y
 * en los Prices de Stripe a la vez: si sólo se cambia un lado, lo facturado
 * deja de cuadrar con lo cobrado.
 */
const IVA_TASA = 0.16;

/**
 * Desglosa un total (IVA incluido) en subtotal + impuestos, en centavos.
 *
 * Se opera con enteros y se calcula `impuestos` por resta —nunca por
 * multiplicación— para garantizar que `subtotal + impuestos === total` sea
 * exacto. Si se calcularan ambos por separado, el redondeo podría dejar una
 * diferencia de 1 centavo y el PAC rechaza el CFDI por importes inconsistentes.
 */
export function desglosarIva(totalCentavos: number): {
  subtotalCentavos: number;
  impuestosCentavos: number;
} {
  const subtotalCentavos = Math.round(totalCentavos / (1 + IVA_TASA));
  return {
    subtotalCentavos,
    impuestosCentavos: totalCentavos - subtotalCentavos,
  };
}

@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,

    @InjectRepository(PerfilFacturacion)
    private readonly perfilRepo: Repository<PerfilFacturacion>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
  ) {}

  /**
   * JLP-H14 — Una factura pertenece a un suscriptor. Sólo ese suscriptor
   * (o un admin) puede listarla, leerla, descargar PDF/XML o cancelarla.
   */
  private assertOwnerSuscriptor(
    ownerSuscriptorId: number | undefined | null,
    requester?: RequesterCtx,
  ): void {
    if (!requester || requester.isAdmin) return;
    if (!requester.sub || Number(ownerSuscriptorId) !== Number(requester.sub)) {
      throw new ForbiddenException('No tienes acceso a esta factura.');
    }
  }

  // ── Listar facturas de un suscriptor ─────────────────────────────────────

  async listar(
    suscriptorId: number,
    limit = 50,
    requester?: RequesterCtx,
  ): Promise<Factura[]> {
    // JLP-H14 — Un usuario sólo puede listar SUS propias facturas.
    this.assertOwnerSuscriptor(suscriptorId, requester);
    return this.facturaRepo.find({
      where: { suscriptorId },
      // Antes ordenaba por `fecha`, columna que no existe en la tabla.
      order: { fechaCreacion: 'DESC', id: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  // ── Obtener una factura ───────────────────────────────────────────────────

  async obtener(id: number, requester?: RequesterCtx): Promise<Factura> {
    const factura = await this.facturaRepo.findOne({ where: { id } });
    if (!factura) throw new NotFoundException(`Factura no encontrada: id=${id}`);
    this.assertOwnerSuscriptor(factura.suscriptorId, requester);
    return factura;
  }

  // ── Perfil de facturación ─────────────────────────────────────────────────

  /**
   * Obtiene (o crea/actualiza) el perfil de facturación del suscriptor a partir
   * de sus datos fiscales.
   *
   * `facturas.perfil_facturacion_id` es NOT NULL con FK, así que sin perfil no
   * hay factura posible. Los datos fiscales editables viven en `suscriptores`
   * (PATCH /suscriptores/:id/datos-fiscales); aquí se proyectan a la tabla
   * normalizada que el CFDI referencia, y se refrescan en cada solicitud para
   * que un cambio de RFC o de régimen se refleje en las facturas siguientes.
   */
  private async resolverPerfilFacturacion(
    suscriptor: Suscriptor,
  ): Promise<PerfilFacturacion> {
    // El SAT exige los cinco datos del receptor para timbrar un CFDI 4.0.
    // Validarlos aquí evita crear borradores que el PAC va a rechazar después.
    const faltantes: string[] = [];
    if (!suscriptor.rfc) faltantes.push('RFC');
    if (!suscriptor.razonSocial) faltantes.push('razón social');
    if (!suscriptor.regimenFiscal) faltantes.push('régimen fiscal');
    if (!suscriptor.usoCfdi) faltantes.push('uso del CFDI');
    if (!suscriptor.codigoPostalFiscal) faltantes.push('código postal fiscal');

    if (faltantes.length) {
      throw new BadRequestException(
        `Faltan datos fiscales para poder facturar: ${faltantes.join(', ')}. ` +
          `Complétalos en tus datos de facturación antes de solicitar la factura.`,
      );
    }

    // El correo de facturación puede caer al correo de la cuenta: no es un dato
    // que el SAT valide, sólo es a dónde se envía el CFDI.
    const email = suscriptor.emailFiscal ?? suscriptor.correoElectronico;
    if (!email) {
      throw new BadRequestException(
        'Falta un correo para enviar la factura. Registra tu correo de facturación.',
      );
    }

    const datos = {
      suscriptorId: suscriptor.id,
      rfc: suscriptor.rfc!.toUpperCase().trim(),
      razonSocial: suscriptor.razonSocial!.trim(),
      regimenFiscal: suscriptor.regimenFiscal!.trim(),
      usoCfdi: suscriptor.usoCfdi!.trim(),
      codigoPostal: suscriptor.codigoPostalFiscal!.trim(),
      emailFacturacion: email.trim(),
      telefono: suscriptor.telefonoCelular ?? null,
      activo: true,
    };

    // UNIQUE(suscriptor_id) en la BD -> a lo más un perfil por suscriptor.
    const existente = await this.perfilRepo.findOne({
      where: { suscriptorId: suscriptor.id },
    });

    if (existente) {
      Object.assign(existente, datos);
      return this.perfilRepo.save(existente);
    }

    return this.perfilRepo.save(this.perfilRepo.create(datos));
  }

  // ── Solicitar factura ─────────────────────────────────────────────────────

  /**
   * Registra una factura en estatus 'borrador'.
   *
   * El timbrado ante el PAC (Facturapi, Finkok, etc.) es un paso posterior:
   * cuando ocurra, se llenan uuid, folio, xml_url, pdf_url y fecha_emision, y
   * el estatus pasa a 'emitida'.
   */
  async solicitar(
    dto: SolicitarFacturaDto,
    requester?: RequesterCtx,
  ): Promise<Factura> {
    // JLP-H14 — Sólo puedes solicitar facturas a tu propio nombre.
    this.assertOwnerSuscriptor(dto.suscriptorId, requester);

    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id: dto.suscriptorId, eliminado: false },
    });
    if (!suscriptor) {
      throw new NotFoundException(`Suscriptor no encontrado: id=${dto.suscriptorId}`);
    }

    // Validar pago si se proporcionó (el id de Pago es string en su entity)
    let pago: Pago | null = null;
    if (dto.pagoId != null) {
      pago = await this.pagoRepo.findOne({
        where: { id: String(dto.pagoId) as any },
      });
      if (!pago) throw new NotFoundException(`Pago no encontrado: id=${dto.pagoId}`);

      // El pago debe ser del mismo suscriptor que factura: si no, se podría
      // facturar a nombre propio el pago de otra persona.
      const duenoPago = (pago as any).suscriptorId ?? (pago as any).suscriptor?.id;
      if (duenoPago != null && Number(duenoPago) !== Number(dto.suscriptorId)) {
        throw new ForbiddenException('Ese pago no pertenece a este suscriptor.');
      }
    }

    // Monto: explícito en el DTO o derivado del pago.
    const totalCentavos =
      dto.totalCentavos != null
        ? dto.totalCentavos
        : pago
          ? Math.round(Number(pago.monto) * 100)
          : 0;

    if (!Number.isFinite(totalCentavos) || totalCentavos <= 0) {
      throw new BadRequestException(
        'No se pudo determinar el importe a facturar. Indica totalCentavos o un pagoId válido.',
      );
    }

    // Evita duplicar el CFDI del mismo pago: el SAT no admite dos facturas
    // vivas por la misma operación.
    if (pago) {
      const yaFacturado = await this.facturaRepo.findOne({
        where: { pagoId: Number(pago.id) },
      });
      if (yaFacturado && yaFacturado.estatus !== 'cancelada') {
        throw new BadRequestException(
          `Ese pago ya tiene la factura #${yaFacturado.id}.`,
        );
      }
    }

    const perfil = await this.resolverPerfilFacturacion(suscriptor);
    const { subtotalCentavos, impuestosCentavos } = desglosarIva(totalCentavos);

    const factura = this.facturaRepo.create({
      suscriptorId: dto.suscriptorId,
      perfilFacturacionId: perfil.id,
      pagoId: pago ? Number(pago.id) : null,
      estatus: 'borrador',
      subtotalCentavos,
      impuestosCentavos,
      totalCentavos,
      moneda: 'MXN',
    });

    const guardada = await this.facturaRepo.save(factura);

    this.logger.log(
      `[FACTURAS] Borrador #${guardada.id} — suscriptor=${dto.suscriptorId} ` +
        `total=${(totalCentavos / 100).toFixed(2)} MXN (subtotal ${(subtotalCentavos / 100).toFixed(2)} + IVA ${(impuestosCentavos / 100).toFixed(2)})`,
    );

    return guardada;
  }

  // ── URL de PDF ────────────────────────────────────────────────────────────

  async getPdfUrl(
    id: number,
    requester?: RequesterCtx,
  ): Promise<{ id: number; pdfUrl: string | null; estatus: string }> {
    const factura = await this.obtener(id, requester);
    return { id: factura.id, pdfUrl: factura.pdfUrl ?? null, estatus: factura.estatus };
  }

  // ── URL de XML ────────────────────────────────────────────────────────────

  async getXmlUrl(
    id: number,
    requester?: RequesterCtx,
  ): Promise<{ id: number; xmlUrl: string | null; estatus: string }> {
    const factura = await this.obtener(id, requester);
    return { id: factura.id, xmlUrl: factura.xmlUrl ?? null, estatus: factura.estatus };
  }

  // ── Cancelar factura ──────────────────────────────────────────────────────

  async cancelar(id: number, requester?: RequesterCtx): Promise<Factura> {
    const factura = await this.obtener(id, requester);

    if (factura.estatus === 'cancelada') {
      throw new BadRequestException('La factura ya está cancelada.');
    }

    // Una factura ya timbrada no se cancela sólo en nuestra BD: hay que pedir
    // la cancelación al SAT a través del PAC, y el receptor puede rechazarla.
    // Marcarla aquí sin cancelarla allá dejaría a Jelpy y al SAT en desacuerdo.
    if (factura.estatus === 'emitida') {
      throw new BadRequestException(
        'Esta factura ya fue timbrada ante el SAT. Su cancelación debe solicitarse ' +
          'al proveedor de facturación (aún no integrado). Contacta a soporte.',
      );
    }

    factura.estatus = 'cancelada';
    return this.facturaRepo.save(factura);
  }
}
