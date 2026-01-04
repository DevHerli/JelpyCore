import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    // 465 = SSL/TLS directo
    const secure = port === 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async sendOtp(to: string, code: string) {
    const from =
      this.configService.get<string>('SMTP_FROM') ??
      this.configService.get<string>('SMTP_USER') ??
      '"Jelpy" <no-reply@jelpy.mx>';

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'Código para restablecer tu contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.5">
            <h2>Recuperación de contraseña</h2>
            <p>Tu código es:</p>
            <div style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</div>
            <p>Este código expira en 5 minutos.</p>
          </div>
        `,
      });
    } catch (e) {
      // deja visible la causa real en consola
      console.error('SMTP SEND ERROR:', e);
      throw new InternalServerErrorException(
        'No fue posible enviar el correo. Revisa configuración SMTP.',
      );
    }
  }
}
