import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Pago, EstatusPago, MetodoPago } from './entities/pago.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Membresia } from '../business/membresias/entities/membresia.entity';
import { SuscripcionesService } from '../suscripciones/suscripciones.service';
import { EstadoCuentaMovimiento } from '../suscripciones/entities/estado-cuenta-movimiento.entity';
import { StripeService } from './stripe/stripe.service';

type CreatePaymentInput = {
  negocioId: number;
  suscriptorId: number;
  membresiaId: number;
  monto: number; // decimal (MXN) ej: 599.00
  metodoPago?: MetodoPago; // stripe|conekta|transferencia|oxxo|paypal
  referenciaExterna?: string | null; // opcional al crear
  comprobanteUrl?: string | null;
  descripcionLedger?: string; // si quieres custom
};

type ListPaymentsQuery = {
  suscriptorId?: number;
  negocioId?: number;
  estatus?: EstatusPago;
  limit?: number;
  offset?: number;
};

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagosRepo: Repository<Pago>,
    @InjectRepository(Suscriptor)
    private readonly suscriptoresRepo: Repository<Suscriptor>,
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    private readonly dataSource: DataSource,
    private readonly suscripcionesService: SuscripcionesService,
    private readonly stripeService: StripeService,
  ) {}

  // =========================
  // Helpers
  // =========================

  private toMoneyString(value: number): string {
    // DECIMAL(10,2) => guardamos como string en entity
    if (!Number.isFinite(value) || value <= 0) throw new BadRequestException('monto inválido');
    return value.toFixed(2);
  }

  private moneyToCents(monto: number): number {
    // Evita float issues
    return Math.round((Number(monto) || 0) * 100);
  }

  private normalizeReferencia(ref?: string | null): string | null {
    const v = (ref ?? '').trim();
    return v.length ? v : null;
  }

  // =========================
  // CRUD / Queries
  // =========================

  /**
   * Crea un pago en estatus "pendiente".
   * (Luego tu pasarela lo pasa a "procesando" y "pagado")
   */
  async createPayment(input: CreatePaymentInput) {
    const negocioId = input.negocioId ? Number(input.negocioId) : null;
    const suscriptorId = Number(input.suscriptorId);
    const membresiaId = Number(input.membresiaId);

    if (negocioId !== null && (!Number.isFinite(negocioId) || negocioId <= 0)) {
      throw new BadRequestException('negocioId inválido');
    }
    if (!Number.isFinite(suscriptorId) || suscriptorId <= 0) {
      throw new BadRequestException('suscriptorId inválido');
    }
    if (!Number.isFinite(membresiaId) || membresiaId <= 0) {
      throw new BadRequestException('membresiaId inválido');
    }

    // valida suscriptor
    const sus = await this.suscriptoresRepo.findOne({
      where: { id: suscriptorId as any },
      select: ['id'] as any,
    });
    if (!sus) throw new NotFoundException(`Suscriptor no existe: id=${suscriptorId}`);

    // valida membresia
    const mem = await this.membresiasRepo.findOne({
      where: { id: membresiaId as any },
      select: ['id', 'nombre'] as any,
    });
    if (!mem) throw new NotFoundException(`Membresía no existe: id=${membresiaId}`);

    const referenciaExterna = this.normalizeReferencia(input.referenciaExterna);

    // Si ya trae referencia externa, debemos respetar UNIQUE
    if (referenciaExterna) {
      const exists = await this.pagosRepo.findOne({
        where: { referenciaExterna },
        select: ['id'] as any,
      });
      if (exists) {
        throw new ConflictException(`referencia_externa ya existe: ${referenciaExterna}`);
      }
    }

    const pago = this.pagosRepo.create({
      negocioId: negocioId ? String(negocioId) : null,
      suscriptorId: String(suscriptorId),
      membresiaId: String(membresiaId),
      monto: this.toMoneyString(Number(input.monto)),
      metodoPago: (input.metodoPago ?? 'stripe') as MetodoPago,
      estatus: 'pendiente',
      referenciaExterna,
      comprobanteUrl: this.normalizeReferencia(input.comprobanteUrl),
    });

    const saved = await this.pagosRepo.save(pago);

    return {
      ok: true,
      pago: {
        id: Number(saved.id),
        negocioId,
        suscriptorId,
        membresiaId,
        monto: Number(saved.monto),
        metodoPago: saved.metodoPago,
        estatus: saved.estatus,
        referenciaExterna: saved.referenciaExterna,
        comprobanteUrl: saved.comprobanteUrl,
        fechaCreacion: saved.fechaCreacion,
        fechaActualizacion: saved.fechaActualizacion,
      },
    };
  }


    async listPagos(params: {
    negocioId?: number;
    suscriptorId?: number;
    limit: number;
  }) {
    const { negocioId, suscriptorId, limit } = params;

    // where dinámico
    const where: any = {};
    if (negocioId) where.negocioId = negocioId;
    if (suscriptorId) where.suscriptorId = suscriptorId;

    const list = await this.pagosRepo.find({
      where,
      order: { fechaCreacion: 'DESC', id: 'DESC' } as any,
      take: limit,
    });

    // respuesta consistente con tu frontend
    return (list || []).map((p: any) => ({
      id: Number(p.id),
      negocioId: Number(p.negocioId),
      suscriptorId: Number(p.suscriptorId),
      membresiaId: Number(p.membresiaId),
      monto: Number(p.monto),
      metodoPago: p.metodoPago,
      estatus: p.estatus,
      referenciaExterna: p.referenciaExterna ?? null,
      comprobanteUrl: p.comprobanteUrl ?? null,
      fechaCreacion: p.fechaCreacion,
      fechaActualizacion: p.fechaActualizacion ?? null,
    }));
  }

  async listPayments(query: ListPaymentsQuery) {
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const offset = Math.max(Number(query.offset || 0), 0);

    const qb = this.pagosRepo.createQueryBuilder('p').orderBy('p.fechaCreacion', 'DESC').addOrderBy('p.id', 'DESC');

    if (query.suscriptorId) qb.andWhere('p.suscriptor_id = :suscriptorId', { suscriptorId: Number(query.suscriptorId) });
    if (query.negocioId) qb.andWhere('p.negocio_id = :negocioId', { negocioId: Number(query.negocioId) });
    if (query.estatus) qb.andWhere('p.estatus = :estatus', { estatus: query.estatus });

    const [rows, total] = await qb.take(limit).skip(offset).getManyAndCount();

    return {
      ok: true,
      total,
      limit,
      offset,
      data: rows.map((r) => ({
        id: Number(r.id),
        negocioId: Number(r.negocioId),
        suscriptorId: Number(r.suscriptorId),
        membresiaId: Number(r.membresiaId),
        monto: Number(r.monto),
        metodoPago: r.metodoPago,
        estatus: r.estatus,
        referenciaExterna: r.referenciaExterna,
        comprobanteUrl: r.comprobanteUrl,
        fechaCreacion: r.fechaCreacion,
        fechaActualizacion: r.fechaActualizacion,
      })),
    };
  }

  async getPaymentById(id: number) {
    const pago = await this.pagosRepo.findOne({
      where: { id: String(id) as any },
    });
    if (!pago) throw new NotFoundException(`Pago no existe: id=${id}`);

    return {
      ok: true,
      pago: {
        id: Number(pago.id),
        negocioId: Number(pago.negocioId),
        suscriptorId: Number(pago.suscriptorId),
        membresiaId: Number(pago.membresiaId),
        monto: Number(pago.monto),
        metodoPago: pago.metodoPago,
        estatus: pago.estatus,
        referenciaExterna: pago.referenciaExterna,
        comprobanteUrl: pago.comprobanteUrl,
        fechaCreacion: pago.fechaCreacion,
        fechaActualizacion: pago.fechaActualizacion,
      },
    };
  }

  // =========================
  // Status transitions (PROD)
  // =========================

  /**
   * Cambia estatus (pendiente|procesando|pagado|fallido|reembolsado)
   * y si queda en "pagado", escribe ABONO en estado_cuenta_movimientos.
   *
   * Idempotente:
   * - si ya estaba "pagado", no duplica abono (se bloquea por transacción + verificación).
   */

async markAsPaid(
  pagoId: number,
  meta: {
    metodoPago: 'stripe' | 'conekta' | 'transferencia' | 'oxxo' | 'paypal';
    referenciaExterna: string;
    rawStripeEventId?: string;
  },
) {
  const runner = this.dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    const pagosRepoTx = runner.manager.getRepository(Pago);

    const pago = await pagosRepoTx.findOne({ where: { id: pagoId } as any });
    if (!pago) throw new BadRequestException(`Pago no existe: id=${pagoId}`);

    // idempotente
    if (String((pago as any).estatus) === 'pagado') {
      await runner.commitTransaction();
      return { ok: true, alreadyPaid: true };
    }

    await pagosRepoTx.update(
      { id: pagoId } as any,
      {
        estatus: 'pagado',
        metodoPago: meta.metodoPago,
        referenciaExterna: meta.referenciaExterna,
        fechaActualizacion: new Date(),
      } as any,
    );

    // decimal -> centavos
    const monto = Number((pago as any).monto || 0);
    const abonoCentavos = Math.round(monto * 100);

    await this.suscripcionesService.crearMovimientoEstadoCuenta({
      suscriptorId: Number((pago as any).suscriptorId || (pago as any).suscriptor_id),
      tipoMovimiento: 'abono',
      descripcion: `Pago recibido ${meta.metodoPago.toUpperCase()}`,
      referenciaTabla: 'pagos',
      referenciaId: Number((pago as any).id),
      cargoCentavos: 0,
      abonoCentavos,
      moneda: 'MXN',
    });

    await runner.commitTransaction();

    // Crear/renovar suscripción activa (best-effort — no falla el pago si hay error)
    try {
      await this.suscripcionesService.renovarOCrearSuscripcion({
        suscriptorId: Number((pago as any).suscriptorId),
        membresiaId:  Number((pago as any).membresiaId),
        pagoId,
      });
    } catch (e: any) {
      console.warn(`[PagosService] renovarOCrearSuscripcion warning: ${e?.message}`);
    }

    return { ok: true };
  } catch (e) {
    await runner.rollbackTransaction();
    throw e;
  } finally {
    await runner.release();
  }
}

  /**
   * Marca pago como fallido (no toca ledger).
   */
async markAsFailed(
  pagoId: number,
  meta: {
    metodoPago: 'stripe' | 'conekta' | 'transferencia' | 'oxxo' | 'paypal';
    referenciaExterna?: string;
    rawStripeEventId?: string;
  },
) {
  await this.pagosRepo.update(
    { id: pagoId } as any,
    {
      estatus: 'fallido',
      metodoPago: meta.metodoPago,
      referenciaExterna: meta.referenciaExterna ?? null,
      fechaActualizacion: new Date(),
    } as any,
  );

  return { ok: true };
}


  async markAsPaidFromStripe(params: {
  referenciaExterna: string;
  monto: number; // en pesos (ej: 599)
  moneda?: string;
}): Promise<{ ok: true; pagoId: number; alreadyPaid?: boolean }> {
  const { referenciaExterna } = params;

  const runner = this.dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    const pagosRepoTx = runner.manager.getRepository(Pago);

    // 1) buscar pago por referencia_externa (UNIQUE)
    const pago = await pagosRepoTx.findOne({
      where: { referenciaExterna },
      lock: { mode: 'pessimistic_write' },
    });

    if (!pago) {
      // si no existe, dependiendo de tu flujo:
      // - o lo ignoras (200 OK) para no reintentos eternos
      // - o lo creas si tu checkout crea el pago aquí
      await runner.commitTransaction();
      return { ok: true, pagoId: 0, alreadyPaid: true };
    }

    if (pago.estatus === 'pagado') {
      await runner.commitTransaction();
      return { ok: true, pagoId: Number(pago.id), alreadyPaid: true };
    }

    // 2) marcar pago como pagado
    pago.estatus = 'pagado';
    await pagosRepoTx.save(pago);

    // 3) crear abono en estado de cuenta (idempotencia extra por referencia)
    // Regla: si ya existe un movimiento con referencia_tabla='pagos' y referencia_id=pago.id, no duplicar.
    // (tu tabla ECM no tiene unique, entonces lo hacemos por query + lock natural por transacción)
    const ecmRepoTx = runner.manager.getRepository(EstadoCuentaMovimiento);

    const yaExiste = await ecmRepoTx.findOne({
      where: {
        referenciaTabla: 'pagos',
        referenciaId: Number(pago.id),
      } as any,
    });

    if (!yaExiste) {
      // Abono centavos:
      const abonoCentavos = Math.round(Number(pago.monto) * 100);

      await this.suscripcionesService.crearMovimientoEstadoCuenta({
        suscriptorId: Number(pago.suscriptorId),
        tipoMovimiento: 'abono',
        descripcion: 'Pago recibido Stripe',
        referenciaTabla: 'pagos',
        referenciaId: Number(pago.id),
        abonoCentavos,
        cargoCentavos: 0,
        moneda: 'MXN',
      });
    }

    await runner.commitTransaction();
    return { ok: true, pagoId: Number(pago.id) };
  } catch (e) {
    await runner.rollbackTransaction();
    throw e;
  } finally {
    await runner.release();
  }
}


  async attachExternalReferenceIfMissing(pagoId: number, referenciaExterna: string) {
    if (!pagoId || pagoId <= 0) return;

    await this.pagosRepo
      .createQueryBuilder()
      .update()
      .set({ referenciaExterna })
      .where('id = :pagoId', { pagoId })
      .andWhere('(referencia_externa IS NULL OR referencia_externa = "")')
      .execute();
  }

  // =====================================================================
  // STRIPE — Customer, Payment Methods, Checkout
  // =====================================================================

  /** Obtiene o crea el Stripe Customer para el suscriptor. Idempotente. */
  async ensureStripeCustomer(suscriptorId: number): Promise<string> {
    const sus = await this.suscriptoresRepo.findOne({ where: { id: suscriptorId as any } });
    if (!sus) throw new NotFoundException(`Suscriptor no existe: id=${suscriptorId}`);

    if (sus.stripeCustomerId) return sus.stripeCustomerId;

    const customer = await this.stripeService.client.customers.create({
      name:  `${sus.nombre} ${sus.apellidoPaterno}`.trim(),
      email: sus.correoElectronico ?? undefined,
      metadata: { suscriptor_id: String(suscriptorId) },
    });

    await this.suscriptoresRepo.update(suscriptorId as any, {
      stripeCustomerId: customer.id,
    } as any);

    return customer.id;
  }

  /**
   * 1.1 POST /pagos/stripe/customer
   * Crea o recupera el Stripe Customer asociado al suscriptor.
   */
  async getOrCreateCustomer(suscriptorId: number) {
    const customerId = await this.ensureStripeCustomer(suscriptorId);
    return { customerId };
  }

  /**
   * 1.2 POST /pagos/stripe/setup-intent
   * SetupIntent para guardar tarjeta sin cobrar.
   */
  async createSetupIntent(suscriptorId: number) {
    const customerId = await this.ensureStripeCustomer(suscriptorId);
    const si = await this.stripeService.client.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return { clientSecret: si.client_secret };
  }

  /**
   * 1.3 GET /pagos/metodos/:suscriptorId
   * Lista los métodos de pago (tarjetas) guardados en Stripe.
   */
  async listPaymentMethods(suscriptorId: number) {
    const sus = await this.suscriptoresRepo.findOne({ where: { id: suscriptorId as any } });
    if (!sus?.stripeCustomerId) return [];

    const [pms, customer] = await Promise.all([
      this.stripeService.client.paymentMethods.list({
        customer: sus.stripeCustomerId,
        type: 'card',
      }),
      this.stripeService.client.customers.retrieve(sus.stripeCustomerId),
    ]);

    const defaultPmId = (customer as any)?.invoice_settings?.default_payment_method ?? null;

    return pms.data.map((pm) => ({
      id:       pm.id,
      brand:    pm.card?.brand     ?? null,
      last4:    pm.card?.last4     ?? null,
      expMonth: pm.card?.exp_month ?? null,
      expYear:  pm.card?.exp_year  ?? null,
      isDefault: pm.id === defaultPmId,
    }));
  }

  /**
   * 1.4 DELETE /pagos/metodos/:paymentMethodId
   * Desvincula la tarjeta del customer en Stripe.
   */
  async deletePaymentMethod(paymentMethodId: string) {
    await this.stripeService.client.paymentMethods.detach(paymentMethodId);
    return { ok: true };
  }

  /**
   * 1.5 PATCH /pagos/metodos/:paymentMethodId/default
   * Establece la tarjeta como método por defecto del customer.
   */
  async setDefaultPaymentMethod(paymentMethodId: string, suscriptorId: number) {
    const sus = await this.suscriptoresRepo.findOne({ where: { id: suscriptorId as any } });
    if (!sus?.stripeCustomerId) {
      throw new BadRequestException('El suscriptor no tiene customer de Stripe. Llama primero a /pagos/stripe/customer.');
    }

    await this.stripeService.client.customers.update(sus.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    return { ok: true };
  }

  /**
   * 1.6 POST /pagos/stripe/checkout
   * Cobra la membresía con la tarjeta guardada. Crea un Pago pendiente,
   * confirma el PaymentIntent y lo vincula vía metadata para el webhook.
   */
  async createCheckout(dto: {
    suscriptorId: number;
    membresiaId:  number;
    paymentMethodId: string;
  }) {
    const { suscriptorId, membresiaId, paymentMethodId } = dto;

    const membresia = await this.membresiasRepo.findOne({ where: { id: membresiaId as any } });
    if (!membresia) throw new NotFoundException(`Membresía no existe: id=${membresiaId}`);

    const customerId = await this.ensureStripeCustomer(suscriptorId);
    const montoPesos = Number(membresia.precio);
    if (!montoPesos || montoPesos <= 0) throw new BadRequestException('La membresía tiene precio inválido.');

    // 1) Crear registro Pago (pendiente)
    const pagoResult = await this.createPayment({
      negocioId:  null as any,
      suscriptorId,
      membresiaId,
      monto: montoPesos,
      metodoPago: 'stripe',
    });
    const pagoId = pagoResult.pago.id;

    // 2) PaymentIntent con confirm=true
    const pi = await this.stripeService.client.paymentIntents.create({
      amount:   Math.round(montoPesos * 100),
      currency: 'mxn',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        pago_id:       String(pagoId),
        suscriptor_id: String(suscriptorId),
        membresia_id:  String(membresiaId),
      },
    });

    // 3) Vincular referencia_externa
    await this.attachExternalReferenceIfMissing(pagoId, pi.id);

    return {
      clientSecret:    pi.client_secret,
      requiresAction:  pi.status === 'requires_action',
      paymentIntentId: pi.id,
      pagoId,
    };
  }
}