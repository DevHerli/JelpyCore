import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(private readonly config: ConfigService) {
    const key = config.get<string>('STRIPE_SECRET_KEY');

    if (!key) {
      throw new Error(
        'STRIPE_SECRET_KEY no está definida en las variables de entorno. ' +
        'El servidor no puede arrancar sin esta clave.',
      );
    }

    this.stripe = new Stripe(key, {
      apiVersion: '2025-10-29.clover',
    });
  }

  /**
   * Verifica y construye el evento del webhook usando RAW body.
   * Requiere en main.ts:
   * app.use('/pagos/webhook/stripe', bodyParser.raw({ type: 'application/json' }));
   */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

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