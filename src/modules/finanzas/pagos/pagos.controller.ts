import { Body, Controller, Post } from '@nestjs/common';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  // Crear sesión de pago Stripe
  @Post('crear')
  crearPago(@Body() body: any) {
    return this.pagosService.crearPagoStripe({
      negocioId: body.negocioId,
      suscriptorId: body.suscriptorId,
      membresiaId: body.membresiaId,
      monto: body.monto,
      correo: body.correo,
    });
  }

  // Confirmación (manual o webhook)
  @Post('confirmar')
  confirmarPago(@Body() body: { referencia: string; exitoso: boolean }) {
    return this.pagosService.confirmarPago(body.referencia, body.exitoso);
  }
}
