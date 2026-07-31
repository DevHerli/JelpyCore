import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Factura } from './entities/factura.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Pago } from '../pagos/entities/pago.entity';
import { SolicitarFacturaDto } from './dtos/solicitar-factura.dto';

@Injectable()
export class FacturasService {
  constructor(
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
  ) {}

  // ── Listar facturas de un suscriptor ─────────────────────────────────────

  async listar(suscriptorId: number, limit = 50): Promise<Factura[]> {
    return this.facturaRepo.find({
      where: { suscriptorId },
      order: { fecha: 'DESC', id: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  // ── Obtener una factura ───────────────────────────────────────────────────

  async obtener(id: number): Promise<Factura> {
    const factura = await this.facturaRepo.findOne({ where: { id } });
    if (!factura) throw new NotFoundException(`Factura no encontrada: id=${id}`);
    return factura;
  }

  // ── Solicitar factura ─────────────────────────────────────────────────────
  /**
   * Crea un registro de factura en estatus 'pendiente'.
   * Aquí se haría la llamada al PAC (Facturapi, etc.) en producción real.
   * Por ahora se guarda el snapshot de datos fiscales y queda pendiente de emisión.
   */
  async solicitar(dto: SolicitarFacturaDto): Promise<Factura> {
    // Validar suscriptor y datos fiscales
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id: dto.suscriptorId, eliminado: false },
    });
    if (!suscriptor) throw new NotFoundException(`Suscriptor no encontrado: id=${dto.suscriptorId}`);

    if (!suscriptor.rfc) {
      throw new BadRequestException(
        'El suscriptor no tiene datos fiscales registrados. Agrega RFC y razón social antes de solicitar una factura.',
      );
    }

    // Validar pago si se proporcionó
    let pago: Pago | undefined;
    if (dto.pagoId) {
      pago = await this.pagoRepo.findOne({ where: { id: String(dto.pagoId) as any } }) ?? undefined;
      if (!pago) throw new NotFoundException(`Pago no encontrado: id=${dto.pagoId}`);
    }

    // Resolver monto: del pago o del DTO
    const totalCentavos =
      dto.totalCentavos != null
        ? dto.totalCentavos
        : pago
        ? Math.round(Number(pago.monto) * 100)
        : 0;

    const factura = this.facturaRepo.create({
      suscriptorId:  dto.suscriptorId,
      suscriptor:    { id: dto.suscriptorId } as any,
      pago:          pago ? ({ id: pago.id } as any) : undefined,
      pagoId:        pago ? Number(pago.id) : undefined,
      concepto:      dto.concepto ?? (pago ? `Pago #${pago.id}` : 'Membresía Jelpy'),
      totalCentavos,
      estatus:       'pendiente' as const,
      // Snapshot fiscal
      rfc:         suscriptor.rfc,
      razonSocial: suscriptor.razonSocial ?? undefined,
    });

    const saved = await this.facturaRepo.save(factura);
    return saved as Factura;
  }

  // ── URL de PDF ────────────────────────────────────────────────────────────

  async getPdfUrl(id: number): Promise<{ id: number; pdfUrl: string | null }> {
    const factura = await this.obtener(id);
    return { id: factura.id, pdfUrl: factura.pdfUrl ?? null };
  }

  // ── URL de XML ────────────────────────────────────────────────────────────

  async getXmlUrl(id: number): Promise<{ id: number; xmlUrl: string | null }> {
    const factura = await this.obtener(id);
    return { id: factura.id, xmlUrl: factura.xmlUrl ?? null };
  }

  // ── Cancelar factura ──────────────────────────────────────────────────────

  async cancelar(id: number): Promise<Factura> {
    const factura = await this.obtener(id);
    if (factura.estatus === 'cancelada') {
      throw new BadRequestException('La factura ya está cancelada.');
    }
    factura.estatus = 'cancelada';
    return this.facturaRepo.save(factura);
  }
}
