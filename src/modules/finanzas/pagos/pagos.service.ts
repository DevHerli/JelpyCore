import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pago } from './entities/pago.entity';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PagosService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepo: Repository<Pago>,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
        apiVersion: '2024-04-10' as Stripe.LatestApiVersion,
      });
  }

  async crearPagoStripe(data: {
    negocioId: number;
    suscriptorId: number;
    membresiaId: number;
    monto: number;
    correo: string;
  }) {
    try {
      // 1️⃣ Crear registro del pago en BD
      const pago = this.pagoRepo.create({
        negocio: { id: data.negocioId } as any,
        suscriptor: { id: data.suscriptorId } as any,
        membresia: { id: data.membresiaId } as any,
        monto: data.monto,
        metodoPago: 'stripe',
        estatus: 'pendiente',
      });
      await this.pagoRepo.save(pago);

      // 2️⃣ Crear sesión de pago en Stripe
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: data.correo,
        line_items: [
          {
            price_data: {
              currency: 'mxn',
              product_data: {
                name: `Membresía Jelpy #${data.membresiaId}`,
              },
              unit_amount: Math.round(data.monto * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${this.configService.get<string>('FRONT_URL')}/pago-exitoso`,
        cancel_url: `${this.configService.get<string>('FRONT_URL')}/pago-cancelado`,
      });

      // 3️⃣ Actualizar registro con referencia
      pago.referenciaExterna = session.id;
      pago.estatus = 'procesando';
      await this.pagoRepo.save(pago);

      return { url: session.url };
    } catch (error) {
      console.error('❌ Error en crearPagoStripe:', error);
      throw new BadRequestException('No se pudo crear la sesión de pago.');
    }
  }

  async confirmarPago(referencia: string, exitoso: boolean) {
    const pago = await this.pagoRepo.findOne({ where: { referenciaExterna: referencia } });
    if (!pago) throw new BadRequestException('Pago no encontrado.');

    pago.estatus = exitoso ? 'pagado' : 'fallido';
    await this.pagoRepo.save(pago);
    return pago;
  }
}
