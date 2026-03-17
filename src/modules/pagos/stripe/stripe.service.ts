import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor() {
    // Usa la versión que tu SDK (types) soporta actualmente
    // (evita el error TS2322)
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2025-10-29.clover',
      // opcional: si usas TS/ESM a veces ayuda, pero no es obligatorio
      // typescript: true, // (no existe en StripeConfig; no lo pongas)
    });
  }

  /**
   * Verifica y construye el evento del webhook usando RAW body.
   * Requiere en main.ts:
   * app.use('/pagos/webhook/stripe', bodyParser.raw({ type: 'application/json' }));
   */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET as string;

    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is missing in environment variables.');
    }

    if (!signature) {
      throw new Error('Stripe-Signature header is missing.');
    }

    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  /**
   * Expón el cliente si necesitas crear PaymentIntents, Checkout Sessions, etc.
   */
  get client(): Stripe {
    return this.stripe;
  }
}