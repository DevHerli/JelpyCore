import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Headers as NestHeaders,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { StripeService } from './stripe/stripe.service';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly pagosService: PagosService,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // LISTADO
  // ──────────────────────────────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  async listPagos(
    @Query('negocioId') negocioId?: string,
    @Query('suscriptorId') suscriptorId?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedNegocioId    = negocioId    ? Number(negocioId)    : undefined;
    const parsedSuscriptorId = suscriptorId ? Number(suscriptorId) : undefined;
    const parsedLimit        = limit        ? Number(limit)        : 50;

    if (parsedNegocioId    != null && (!Number.isFinite(parsedNegocioId)    || parsedNegocioId    <= 0)) throw new BadRequestException('negocioId inválido');
    if (parsedSuscriptorId != null && (!Number.isFinite(parsedSuscriptorId) || parsedSuscriptorId <= 0)) throw new BadRequestException('suscriptorId inválido');
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || parsedLimit > 200) throw new BadRequestException('limit inválido (1-200)');

    return this.pagosService.listPagos({
      negocioId:    parsedNegocioId,
      suscriptorId: parsedSuscriptorId,
      limit:        parsedLimit,
    });
  }

  // ──────────────────────────────────────────────────────────────
  // STRIPE — Customer
  // ──────────────────────────────────────────────────────────────

  /** 1.1 Crea o recupera el Stripe Customer del suscriptor */
  @Post('stripe/customer')
  @UseGuards(JwtAuthGuard)
  createCustomer(@Body() body: { suscriptorId: number }) {
    if (!body?.suscriptorId) throw new BadRequestException('suscriptorId requerido');
    return this.pagosService.getOrCreateCustomer(Number(body.suscriptorId));
  }

  /** 1.2 SetupIntent para guardar tarjeta sin cobrar */
  @Post('stripe/setup-intent')
  @UseGuards(JwtAuthGuard)
  createSetupIntent(@Body() body: { suscriptorId: number }) {
    if (!body?.suscriptorId) throw new BadRequestException('suscriptorId requerido');
    return this.pagosService.createSetupIntent(Number(body.suscriptorId));
  }

  // ──────────────────────────────────────────────────────────────
  // STRIPE — Métodos de pago (tarjetas guardadas)
  // ──────────────────────────────────────────────────────────────

  /** 1.3 Lista tarjetas guardadas del suscriptor */
  @Get('metodos/:suscriptorId')
  @UseGuards(JwtAuthGuard)
  listPaymentMethods(@Param('suscriptorId', ParseIntPipe) suscriptorId: number) {
    return this.pagosService.listPaymentMethods(suscriptorId);
  }

  /** 1.4 Elimina una tarjeta guardada */
  @Delete('metodos/:paymentMethodId')
  @UseGuards(JwtAuthGuard)
  deletePaymentMethod(@Param('paymentMethodId') paymentMethodId: string) {
    return this.pagosService.deletePaymentMethod(paymentMethodId);
  }

  /** 1.5 Establece tarjeta por defecto */
  @Patch('metodos/:paymentMethodId/default')
  @UseGuards(JwtAuthGuard)
  setDefaultPaymentMethod(
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: { suscriptorId: number },
  ) {
    if (!body?.suscriptorId) throw new BadRequestException('suscriptorId requerido');
    return this.pagosService.setDefaultPaymentMethod(paymentMethodId, Number(body.suscriptorId));
  }

  // ──────────────────────────────────────────────────────────────
  // STRIPE — Checkout
  // ──────────────────────────────────────────────────────────────

  /** 1.6 Cobra la membresía con la tarjeta guardada */
  @Post('stripe/checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(
    @Body() body: { suscriptorId: number; membresiaId: number; paymentMethodId: string },
  ) {
    if (!body?.suscriptorId)    throw new BadRequestException('suscriptorId requerido');
    if (!body?.membresiaId)     throw new BadRequestException('membresiaId requerido');
    if (!body?.paymentMethodId) throw new BadRequestException('paymentMethodId requerido');

    return this.pagosService.createCheckout({
      suscriptorId:    Number(body.suscriptorId),
      membresiaId:     Number(body.membresiaId),
      paymentMethodId: body.paymentMethodId,
    });
  }

  // ──────────────────────────────────────────────────────────────
  // WEBHOOK STRIPE (raw body — sin guards, sin tocar)
  // ──────────────────────────────────────────────────────────────
  @Post('webhook/stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: Request & { body: Buffer },
    @Res() res: Response,
    @NestHeaders('stripe-signature') signature: string,
  ) {
    try {
      if (!signature) throw new BadRequestException('Missing Stripe-Signature header');

      const rawBody = req.body;
      if (!rawBody || !(rawBody instanceof Buffer)) {
        throw new BadRequestException('Invalid raw body. Ensure bodyParser.raw is configured for this route.');
      }

      const event = this.stripeService.constructEvent(rawBody, signature);

      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi     = event.data.object as Stripe.PaymentIntent;
          const pagoId = Number((pi.metadata as any)?.pago_id || (pi.metadata as any)?.pagoId || 0);
          const referenciaExterna = String(pi.id);

          if (pagoId > 0) {
            await this.pagosService.attachExternalReferenceIfMissing(pagoId, referenciaExterna);
            await this.pagosService.markAsPaid(pagoId, {
              metodoPago: 'stripe',
              referenciaExterna,
              rawStripeEventId: event.id,
            });
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const pi     = event.data.object as Stripe.PaymentIntent;
          const pagoId = Number((pi.metadata as any)?.pago_id || (pi.metadata as any)?.pagoId || 0);

          if (pagoId > 0) {
            await this.pagosService.markAsFailed(pagoId, {
              metodoPago: 'stripe',
              referenciaExterna: String(pi.id),
              rawStripeEventId: event.id,
            });
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const inv               = event.data.object as Stripe.Invoice;
          const paymentIntentId   = (inv as any).payment_intent;
          const referenciaExterna = String(paymentIntentId || inv.id);
          const pagoId            = Number((inv as any)?.metadata?.pago_id || 0);

          if (pagoId > 0) {
            await this.pagosService.attachExternalReferenceIfMissing(pagoId, referenciaExterna);
            await this.pagosService.markAsPaid(pagoId, {
              metodoPago: 'stripe',
              referenciaExterna,
              rawStripeEventId: event.id,
            });
          }
          break;
        }

        default:
          break;
      }

      return res.json({ received: true });
    } catch (err: any) {
      return res.status(400).json({
        received: false,
        error: err?.message ?? 'Webhook error',
      });
    }
  }
}
