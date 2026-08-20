/**
 * BillingService — Stripe Checkout + Subscriptions (Apple 3.1.1 compliant)
 *
 * Flujo web-only para planes de pago:
 *   1. El portal web llama a /billing/checkout-session.
 *   2. Este servicio crea una Stripe Checkout Session (mode=subscription).
 *   3. El usuario paga en Stripe Checkout (fuera de la app).
 *   4. Stripe llama al webhook /billing/webhook con la confirmación.
 *   5. SOLO en el webhook se activa el plan, se crea el negocio si aplica,
 *      y se dispara la emisión del CFDI.
 *
 * Nunca se activa un plan en createCheckoutSession; todo ocurre en el webhook.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Stripe from 'stripe';

import { CheckoutSessionDto } from './dto/checkout-session.dto';
import { BillingSubscription } from './entities/billing-subscription.entity';
import { StripeProcessedEvent } from './entities/stripe-event.entity';

import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Negocio } from '../business/negocios/entities/negocio.entity';
import { Membresia } from '../business/membresias/entities/membresia.entity';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,

    @InjectRepository(BillingSubscription)
    private readonly billingRepo: Repository<BillingSubscription>,

    @InjectRepository(StripeProcessedEvent)
    private readonly eventsRepo: Repository<StripeProcessedEvent>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,

    @InjectRepository(Membresia)
    private readonly membresiaRepo: Repository<Membresia>,
  ) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY no configurada');

    this.stripe = new Stripe(key, { apiVersion: '2025-10-29.clover' });
  }

  // ── 1. Checkout Session ──────────────────────────────────────────────────

  /**
   * Crea una Stripe Checkout Session en modo subscription.
   * Solo retorna la URL de Stripe; NO activa el plan.
   */
  async createCheckoutSession(
    dto: CheckoutSessionDto,
    authenticatedSub: number,
  ): Promise<{ checkoutUrl: string }> {
    // ── Seguridad: el suscriptorId del body debe coincidir con el JWT ──
    if (Number(dto.suscriptorId) !== Number(authenticatedSub)) {
      throw new ForbiddenException('No puedes iniciar un pago en nombre de otro usuario.');
    }

    // ── Validar membresía tiene precio y Price de Stripe configurado ──
    const membresia = await this.membresiaRepo.findOne({
      where: { id: dto.membresiaId as any },
    });
    if (!membresia) throw new NotFoundException(`Membresía ${dto.membresiaId} no existe.`);

    const stripePriceId = (membresia as any).stripePriceId as string | null;
    if (!stripePriceId) {
      throw new BadRequestException(
        `La membresía "${membresia.nombre}" no tiene un Price de Stripe configurado. ` +
        `Configura stripePriceId en la tabla membresías.`,
      );
    }
    if (Number(membresia.precio) <= 0) {
      throw new BadRequestException('El plan Free no requiere pago.');
    }

    // ── Validar negocio existente (si se pasa negocioId) ──
    if (dto.negocioId) {
      const negocio = await this.negocioRepo.findOne({
        where: { id: dto.negocioId as any, eliminado: false },
        relations: ['suscriptor'],
      });
      if (!negocio) throw new NotFoundException(`Negocio ${dto.negocioId} no existe.`);

      const ownerId = Number((negocio.suscriptor as any)?.id ?? negocio.suscriptor);
      if (ownerId !== Number(authenticatedSub)) {
        throw new ForbiddenException('No eres propietario de ese negocio.');
      }

      // Cancelar suscripción activa anterior en Stripe si existe
      const existing = await this.billingRepo.findOne({
        where: { negocio: { id: dto.negocioId } as any, planEstatus: 'activo' },
      });
      if (existing?.stripeSubscriptionId) {
        try {
          await this.stripe.subscriptions.cancel(existing.stripeSubscriptionId, {
            prorate: false,
          });
        } catch (e: any) {
          this.logger.warn(`No se pudo cancelar sub anterior ${existing.stripeSubscriptionId}: ${e?.message}`);
        }
      }
    }

    // ── Obtener o crear Stripe Customer ──
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id: dto.suscriptorId as any },
    });
    if (!suscriptor) throw new NotFoundException(`Suscriptor ${dto.suscriptorId} no existe.`);

    const customerId = await this.ensureStripeCustomer(suscriptor);

    // ── Serializar negocioData en metadata (para el webhook) ──
    const metadataRaw: Record<string, string> = {
      suscriptor_id: String(dto.suscriptorId),
      membresia_id:  String(dto.membresiaId),
      negocio_id:    String(dto.negocioId ?? 0),
    };

    if (dto.negocioData && !dto.negocioId) {
      // Limitar a 500 chars por campo (límite de Stripe metadata)
      const serialized = JSON.stringify(dto.negocioData).slice(0, 490);
      metadataRaw['negocio_data'] = serialized;
    }

    const webUrl = this.config.get<string>('WEB_URL') ?? this.config.get<string>('FRONTEND_URL') ?? 'https://jelpy.mx';

    // ── Crear Checkout Session ──
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      metadata: metadataRaw,
      subscription_data: {
        metadata: metadataRaw, // propaga metadata a la suscripción para el webhook
      },
      success_url: `${webUrl}/cuenta?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${webUrl}/cuenta?pago=cancelado`,
      allow_promotion_codes: true,
      locale: 'es',
    });

    if (!session.url) throw new BadRequestException('Stripe no devolvió una URL de checkout.');

    this.logger.log(
      `[BILLING] Checkout Session creada: ${session.id} — suscriptor=${dto.suscriptorId} membresia=${dto.membresiaId}`,
    );

    return { checkoutUrl: session.url };
  }

  // ── 2. Webhook handler ───────────────────────────────────────────────────

  /**
   * Procesa eventos de Stripe. ÚNICA fuente de verdad para activar planes.
   * Idempotente: si el evento ya fue procesado, devuelve 200 sin hacer nada.
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    // Se aceptan los dos nombres: la documentación de integración usa
    // STRIPE_WEBHOOK_SECRET y el código original STRIPE_BILLING_WEBHOOK_SECRET.
    // Si sólo se reconociera uno, configurar el otro dejaría el webhook muerto
    // y los pagos no activarían nada (el cobro sí ocurre en Stripe).
    const webhookSecret =
      this.config.get<string>('STRIPE_BILLING_WEBHOOK_SECRET') ??
      this.config.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      throw new Error(
        'Falta el secreto del webhook: define STRIPE_WEBHOOK_SECRET ' +
          '(o STRIPE_BILLING_WEBHOOK_SECRET) con el valor whsec_... de Stripe.',
      );
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Firma de webhook inválida: ${err.message}`);
    }

    // ── Idempotencia: verificar si ya procesamos este evento ──
    const already = await this.eventsRepo.findOne({
      where: { stripeEventId: event.id },
    });
    if (already) {
      this.logger.debug(`[BILLING] Evento ya procesado: ${event.id} (${event.type})`);
      return;
    }

    this.logger.log(`[BILLING] Procesando evento: ${event.id} (${event.type})`);

    let errorMsg: string | undefined;

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        // Stripe emite AMBOS eventos al cobrar una factura. Se escuchan los dos
        // porque el webhook del dashboard puede tener suscrito sólo uno; si
        // fuera `invoice.payment_succeeded` (el que se suele elegir) y aquí
        // sólo existiera `invoice.paid`, las RENOVACIONES se ignorarían en
        // silencio y los planes vencerían pese a estar pagados.
        //
        // OJO: los dos eventos traen event.id distinto, así que la idempotencia
        // por evento NO los deduplica. onInvoicePaid deduplica además por id de
        // factura; sin eso se emitirían DOS CFDI por el mismo cobro.
        case 'invoice.paid':
        case 'invoice.payment_succeeded':
          await this.onInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.updated':
          await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          this.logger.debug(`[BILLING] Evento ignorado: ${event.type}`);
      }
    } catch (err: any) {
      errorMsg = err?.message ?? 'Error desconocido';
      this.logger.error(`[BILLING] Error procesando ${event.id}: ${errorMsg}`, err?.stack);
      // Guardamos el error pero NO relanzamos: Stripe reintentará si devolvemos 2xx
    }

    // ── Registrar evento (éxito o error) para idempotencia ──
    await this.eventsRepo.save(
      this.eventsRepo.create({
        stripeEventId: event.id,
        eventType:     event.type,
        status:        errorMsg ? 'error' : 'success',
        errorMessage:  errorMsg,
      }),
    );
  }

  // ── 3. Estado del plan por negocio ───────────────────────────────────────

  /**
   * Devuelve el estado del plan de un negocio para consumo de la app.
   * Si no hay BillingSubscription → plan Free.
   */
  async getPlanStatus(negocioId: number): Promise<{
    negocioId:    number;
    plan:         string;
    estado:       string;
    vigenteHasta: string | null;
    gestionUrl:   string;
  }> {
    const billing = await this.billingRepo.findOne({
      where: { negocio: { id: negocioId } as any },
      order: { id: 'DESC' },
      relations: ['membresia'],
    });

    const webUrl   = this.config.get<string>('WEB_URL') ?? this.config.get<string>('FRONTEND_URL') ?? 'https://jelpy.mx';
    const gestionUrl = `${webUrl}/cuenta`;

    if (!billing || billing.planEstatus === 'vencido') {
      return {
        negocioId,
        plan:         'Free',
        estado:       billing?.planEstatus === 'vencido' ? 'vencido' : 'free',
        vigenteHasta: null,
        gestionUrl,
      };
    }

    return {
      negocioId,
      plan:         billing.membresia?.nombre ?? 'Free',
      estado:       billing.planEstatus,
      vigenteHasta: billing.planVigenteHasta
        ? billing.planVigenteHasta.toISOString().split('T')[0]
        : null,
      gestionUrl,
    };
  }

  // ── Handlers de eventos específicos ─────────────────────────────────────

  private async onCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const meta          = session.metadata ?? {};
    const suscriptorId  = Number(meta['suscriptor_id']  ?? 0);
    const membresiaId   = Number(meta['membresia_id']   ?? 0);
    let   negocioId     = Number(meta['negocio_id']     ?? 0);
    const negocioDataRaw = meta['negocio_data'];

    if (!suscriptorId || !membresiaId) {
      this.logger.warn(`[BILLING] checkout.session.completed sin metadata: ${session.id}`);
      return;
    }

    // ── Si no hay negocioId → crear el negocio ahora ──
    if (!negocioId && negocioDataRaw) {
      try {
        const negocioData = JSON.parse(negocioDataRaw);
        const negocio = await this.negocioRepo.save(
          this.negocioRepo.create({
            ...negocioData,
            suscriptor: { id: suscriptorId } as any,
          }),
        );
        negocioId = Number((negocio as any).id);
        this.logger.log(`[BILLING] Negocio creado desde webhook: id=${negocioId}`);
      } catch (e: any) {
        this.logger.error(`[BILLING] Error creando negocio desde negocioData: ${e.message}`);
        throw e;
      }
    }

    if (!negocioId) {
      this.logger.warn(`[BILLING] No se pudo determinar negocioId en sesión ${session.id}`);
      return;
    }

    // ── Obtener detalles de la suscripción desde Stripe ──
    const stripeSubId = typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as Stripe.Subscription)?.id;

    let periodEnd: Date | undefined;
    if (stripeSubId) {
      try {
        const sub = await this.stripe.subscriptions.retrieve(stripeSubId);
        // current_period_end puede estar en nivel raíz o en items según la versión de API
        const cpe = (sub as any).current_period_end ?? (sub as any).items?.data?.[0]?.current_period_end;
        if (cpe) periodEnd = new Date(Number(cpe) * 1000);
      } catch {
        // No bloquear el flujo por este lookup
      }
    }

    // ── Monto del pago ──
    const amountTotal  = session.amount_total  ?? 0; // en centavos
    const montoMxn     = amountTotal / 100;

    // ── Upsert BillingSubscription ──
    await this.upsertBillingSubscription({
      negocioId,
      suscriptorId,
      membresiaId,
      stripeSubscriptionId: stripeSubId,
      stripeCustomerId:     typeof session.customer === 'string' ? session.customer : undefined,
      stripeCheckoutSessionId: session.id,
      planEstatus:          'activo',
      planVigenteHasta:     periodEnd,
      ultimoMontoMxn:       montoMxn,
    });

    this.logger.log(
      `[BILLING] Plan activado: negocio=${negocioId} membresia=${membresiaId} sub=${stripeSubId}`,
    );

    // ── Disparar CFDI (best-effort) ──
    await this.triggerCfdi({ suscriptorId, negocioId, montoMxn, membresiaId }).catch((e: any) =>
      this.logger.warn(`[BILLING] CFDI no emitido: ${e?.message}`),
    );
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const inv   = invoice as any; // versión de API puede variar shape de Invoice
    const subId = typeof inv.subscription === 'string'
      ? inv.subscription
      : inv.subscription?.id ?? inv.parent?.subscription_details?.subscription;

    if (!subId) return;

    // ── Idempotencia a nivel FACTURA ──
    // `invoice.paid` e `invoice.payment_succeeded` describen el mismo cobro con
    // event.id distinto, así que ambos llegan hasta aquí. Se marca la factura
    // como procesada usando la misma tabla (tiene índice único en
    // stripe_event_id): el segundo evento choca contra el UNIQUE y se descarta.
    // Sin esto se emitiría un CFDI duplicado por cada renovación.
    const invoiceKey = `invoice:${invoice.id}`;
    try {
      await this.eventsRepo.insert(
        this.eventsRepo.create({
          stripeEventId: invoiceKey,
          eventType:     'invoice.paid.dedupe',
          status:        'success',
        }),
      );
    } catch {
      // Violación de UNIQUE → esta factura ya se procesó. Salir sin duplicar.
      this.logger.debug(`[BILLING] Factura ya procesada, se omite: ${invoice.id}`);
      return;
    }

    // Extender vigencia al próximo periodo
    const sub = await this.stripe.subscriptions.retrieve(subId);
    const cpe = (sub as any).current_period_end ?? (sub as any).items?.data?.[0]?.current_period_end;
    const periodEnd = cpe ? new Date(Number(cpe) * 1000) : undefined;
    const montoMxn  = (invoice.amount_paid ?? 0) / 100;

    const billing = await this.billingRepo.findOne({
      where: { stripeSubscriptionId: subId },
    });
    if (!billing) {
      this.logger.warn(`[BILLING] invoice.paid: no se encontró billing para sub ${subId}`);
      return;
    }

    await this.billingRepo.update(billing.id, {
      planEstatus:      'activo',
      planVigenteHasta: periodEnd ?? billing.planVigenteHasta,
      ultimoMontoMxn:   montoMxn > 0 ? montoMxn : billing.ultimoMontoMxn,
    } as any);

    // `periodEnd` es undefined si Stripe no devolvió current_period_end.
    // Antes se llamaba periodEnd.toISOString() directo: eso lanzaba
    // TypeError justo DESPUÉS de haber actualizado la BD, así que la
    // renovación quedaba aplicada pero el evento se registraba como 'error'.
    const vigencia = periodEnd
      ? periodEnd.toISOString().split('T')[0]
      : 'sin cambio';
    this.logger.log(`[BILLING] Renovación OK: sub=${subId} vigente hasta ${vigencia}`);

    // CFDI en renovación
    if (montoMxn > 0 && billing) {
      await this.triggerCfdi({
        suscriptorId: Number((billing.suscriptor as any)?.id ?? (billing as any).suscriptor_id),
        negocioId:    Number((billing.negocio as any)?.id    ?? (billing as any).negocio_id),
        montoMxn,
        membresiaId:  Number((billing.membresia as any)?.id  ?? (billing as any).membresia_id),
      }).catch((e: any) => this.logger.warn(`[BILLING] CFDI renovación no emitido: ${e?.message}`));
    }
  }

  private async onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const inv   = invoice as any;
    const subId = typeof inv.subscription === 'string'
      ? inv.subscription
      : inv.subscription?.id ?? inv.parent?.subscription_details?.subscription;

    if (!subId) return;

    await this.billingRepo.update(
      { stripeSubscriptionId: subId },
      { planEstatus: 'pago_pendiente' } as any,
    );

    this.logger.warn(`[BILLING] Fallo de pago: sub=${subId} → pago_pendiente`);
  }

  private async onSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const cpe = (sub as any).current_period_end ?? (sub as any).items?.data?.[0]?.current_period_end;
    const periodEnd = cpe ? new Date(Number(cpe) * 1000) : undefined;

    // Mapear estado de Stripe a nuestro enum
    let planEstatus: 'activo' | 'pago_pendiente' | 'vencido';
    switch (sub.status) {
      case 'active':
      case 'trialing':
        planEstatus = 'activo';
        break;
      case 'past_due':
      case 'unpaid':
        planEstatus = 'pago_pendiente';
        break;
      case 'canceled':
      case 'incomplete_expired':
        planEstatus = 'vencido';
        break;
      default:
        planEstatus = 'pago_pendiente';
    }

    await this.billingRepo.update(
      { stripeSubscriptionId: sub.id },
      {
        planEstatus,
        ...(periodEnd ? { planVigenteHasta: periodEnd } : {}),
      } as any,
    );

    this.logger.log(`[BILLING] Suscripción actualizada: ${sub.id} → ${planEstatus}`);
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    await this.billingRepo.update(
      { stripeSubscriptionId: sub.id },
      { planEstatus: 'vencido' } as any,
    );
    this.logger.log(`[BILLING] Suscripción cancelada: ${sub.id} → vencido`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Garantiza que el suscriptor tenga un Stripe Customer. Idempotente. */
  private async ensureStripeCustomer(suscriptor: Suscriptor): Promise<string> {
    if (suscriptor.stripeCustomerId) return suscriptor.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      name:  `${suscriptor.nombre} ${suscriptor.apellidoPaterno}`.trim(),
      email: suscriptor.correoElectronico ?? undefined,
      metadata: { suscriptor_id: String(suscriptor.id) },
    });

    await this.suscriptorRepo.update(suscriptor.id as any, {
      stripeCustomerId: customer.id,
    } as any);

    return customer.id;
  }

  /** Crea o actualiza un BillingSubscription para el negocio. */
  private async upsertBillingSubscription(params: {
    negocioId:              number;
    suscriptorId:           number;
    membresiaId:            number;
    stripeSubscriptionId?:  string;
    stripeCustomerId?:      string;
    stripeCheckoutSessionId?: string;
    planEstatus:            'activo' | 'pago_pendiente' | 'vencido';
    planVigenteHasta?:      Date;
    ultimoMontoMxn?:        number;
  }): Promise<BillingSubscription> {
    const existing = await this.billingRepo.findOne({
      where: { negocio: { id: params.negocioId } as any },
    });

    const data: Partial<BillingSubscription> = {
      negocio:       { id: params.negocioId }    as any,
      suscriptor:    { id: params.suscriptorId } as any,
      membresia:     { id: params.membresiaId }  as any,
      planEstatus:   params.planEstatus,
      planVigenteHasta:       params.planVigenteHasta,
      ultimoMontoMxn:         params.ultimoMontoMxn,
      stripeSubscriptionId:   params.stripeSubscriptionId,
      stripeCustomerId:       params.stripeCustomerId,
      stripeCheckoutSessionId: params.stripeCheckoutSessionId,
    };

    if (existing) {
      await this.billingRepo.update(existing.id, data as any);
      return { ...existing, ...data } as BillingSubscription;
    }

    return this.billingRepo.save(this.billingRepo.create(data));
  }

  /**
   * Dispara la emisión del CFDI tras un pago confirmado.
   * Best-effort: si falla, se loguea pero no se bloquea el flujo.
   * Adaptar según el servicio de facturación utilizado (PAC/SAT).
   */
  private async triggerCfdi(params: {
    suscriptorId: number;
    negocioId:    number;
    montoMxn:     number;
    membresiaId:  number;
  }): Promise<void> {
    // TODO: integrar con FacturasService cuando el PAC esté configurado.
    // Por ahora logramos el evento para que el equipo de facturación lo procese.
    this.logger.log(
      `[BILLING] CFDI pendiente → suscriptor=${params.suscriptorId} ` +
      `negocio=${params.negocioId} monto=${params.montoMxn} MXN`,
    );
  }
}
