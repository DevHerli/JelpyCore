/**
 * BillingController
 *
 * POST /billing/checkout-session  → crea la Stripe Checkout Session (web portal)
 * POST /billing/webhook           → recibe eventos de Stripe (raw body, sin guard)
 * GET  /negocios/:id/membresia    → estado del plan para la app (implementado aquí
 *                                   y también expuesto en NegociosController)
 *
 * Seguridad:
 *  - /checkout-session requiere JwtAuthGuard + rate limiting estricto.
 *  - /webhook NO usa guard de JWT (Stripe llama sin token), pero verifica la
 *    firma HMAC del header stripe-signature. La verificación ocurre en el servicio.
 *  - La publishable key de Stripe NUNCA sale por estos endpoints.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  Headers as NestHeaders,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CheckoutSessionDto } from './dto/checkout-session.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── 1. Crear Checkout Session ────────────────────────────────────────────

  /**
   * POST /billing/checkout-session
   *
   * Llamado desde el portal web https://jelpy.mx/cuenta.
   * Requiere JWT válido del suscriptor.
   * Rate limit estricto: 10 req/10 min para evitar spam de sesiones de Stripe.
   */
  @Post('checkout-session')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 600 } })
  createCheckoutSession(
    @Body() dto: CheckoutSessionDto,
    @Req() req: any,
  ) {
    return this.billingService.createCheckoutSession(dto, req.user.sub);
  }

  // ── 2. Webhook de Stripe ─────────────────────────────────────────────────

  /**
   * POST /billing/webhook
   *
   * Stripe llama aquí tras cada evento de pago/suscripción.
   * Requiere raw body (configurado en main.ts con bodyParser.raw).
   * Sin JwtAuthGuard; la autenticidad se verifica con stripe-signature.
   * Devuelve 200 siempre (incluso si el evento ya fue procesado) para
   * evitar reintentos infinitos de Stripe.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() req: Request & { body: Buffer },
    @Res() res: Response,
    @NestHeaders('stripe-signature') signature: string,
  ) {
    try {
      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      const rawBody = req.body;
      if (!rawBody || !(rawBody instanceof Buffer)) {
        return res.status(400).json({
          error: 'Invalid raw body. Ensure bodyParser.raw is configured for this route.',
        });
      }

      await this.billingService.handleWebhookEvent(rawBody, signature);
      return res.json({ received: true });
    } catch (err: any) {
      // No reenviar 5xx a Stripe (causaría reintentos): devolvemos 400 para
      // errores de firma inválida, 200 para todo lo demás.
      const statusCode = err?.status === 400 ? 400 : 200;
      return res.status(statusCode).json({
        received: false,
        error: err?.message ?? 'Webhook error',
      });
    }
  }

  // ── 3. Estado del plan (para la app) ────────────────────────────────────

  /**
   * GET /billing/negocios/:id/plan
   *
   * La app consulta este endpoint para mostrar el plan actual y desbloquear
   * funciones. No expone datos de pago. Requiere JWT válido.
   *
   * También existe como GET /negocios/:id/membresia (alias en NegociosController).
   */
  @Get('negocios/:id/plan')
  @UseGuards(JwtAuthGuard)
  getPlanStatus(@Param('id', ParseIntPipe) negocioId: number) {
    return this.billingService.getPlanStatus(negocioId);
  }
}
