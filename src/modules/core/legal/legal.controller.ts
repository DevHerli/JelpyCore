/**
 * LegalController — JLP-016 / B6
 *
 * Expone los documentos legales de Jelpy como endpoints públicos.
 * Ambas tiendas (Apple / Google) exigen que la app incluya enlaces
 * accesibles a la Política de Privacidad y a los Términos de Servicio.
 *
 * Los textos se sirven desde variables de entorno para que el equipo
 * legal pueda actualizar las URLs sin redeployar la aplicación.
 * Si las variables no están configuradas, se devuelve una URL de
 * fallback que apunta al sitio de Jelpy.
 *
 * Endpoints públicos (sin autenticación requerida):
 *  GET /legal/privacidad  → { url: string, version: string }
 *  GET /legal/terminos    → { url: string, version: string }
 */
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('legal')
export class LegalController {
  constructor(private readonly configService: ConfigService) {}

  @Get('privacidad')
  privacidad() {
    return {
      ok:      true,
      tipo:    'privacidad',
      titulo:  'Política de Privacidad de Jelpy',
      url:     this.configService.get<string>('LEGAL_URL_PRIVACIDAD')
                 ?? 'https://jelpy.mx/legal/privacidad',
      version: this.configService.get<string>('LEGAL_VERSION_PRIVACIDAD') ?? '1.0',
    };
  }

  @Get('terminos')
  terminos() {
    return {
      ok:      true,
      tipo:    'terminos',
      titulo:  'Términos y Condiciones de Jelpy',
      url:     this.configService.get<string>('LEGAL_URL_TERMINOS')
                 ?? 'https://jelpy.mx/legal/terminos',
      version: this.configService.get<string>('LEGAL_VERSION_TERMINOS') ?? '1.0',
    };
  }
}
