import { Injectable, Logger } from '@nestjs/common';
import { ReportesModeracionService } from '../../reports/reportes-moderacion/reportes-moderacion.service';

@Injectable()
export class ProfanityCheckUseCase {
  private readonly logger = new Logger(ProfanityCheckUseCase.name);

  /** Nivel fuerte → BLOQUEA */
  private readonly bannedStrong = [
    'pendej',
    'pendeja',
    'pendejo',
    'put',
    'puta',
    'puto',
    'mierd',
    'mierda',
    'verga',
    'ching',
    'chinga',
    'chingada',
    'chingado',
    'culer',
    'culero',
    'culera',
    'cono', // normalizado de "coño"
    'matar',
    'asesinar',
    'golpear',
  ];

  /** Nivel suave → PERMITE PERO ADVIERTE */
  private readonly bannedSoft = [
    'idiota',
    'ctm',
    'estupido',
    'menso',
    'tonto',
    'imbecil',
    'tarado',
    'boludo',
    'boluda',
    'bobo',
    'boba',
  ];

  /** Expresiones completas fuertes */
  private readonly bannedExpressions = [
    'a tu madre',
    'a su madre',
    'chinguen a su madre',
    'vete a la verga',
    'chinga tu madre',
  ];

  constructor(
    private readonly reportesService: ReportesModeracionService,
  ) {}

  async execute(
    texto: string,
    corregido?: string,
    contexto?: { ip?: string; userAgent?: string; usuarioId?: number },
  ): Promise<{
    permitido: boolean;
    motivo?: string;
    palabra?: string;
    advertencia?: string;
    severidad?: 'soft' | 'strong';
  }> {
    if (!texto) {
      this.logger.debug('Texto vacío en moderación, permitido.');
      return { permitido: true };
    }

    const lower = this.normalizar(texto);
    this.logger.debug(`Texto moderado: ${lower}`);

    // ====== 1. EXPRESIONES FUERTES ======
    for (const exp of this.bannedExpressions) {
      const expNormalizada = this.normalizar(exp);

      if (lower.includes(expNormalizada)) {
        this.logger.warn(`Expresión fuerte detectada: ${exp}`);
        await this.registrarReporte(texto, corregido, contexto, exp);

        return {
          permitido: false,
          motivo: `Lenguaje inapropiado (${exp})`,
          palabra: exp,
          severidad: 'strong',
        };
      }
    }

    const tokens = lower.split(/\s+/).filter(Boolean);
    this.logger.debug(`Tokens detectados: ${JSON.stringify(tokens)}`);

    // ====== 2. NIVEL FUERTE ======
    for (const token of tokens) {
      for (const root of this.bannedStrong) {
        const rootNormalizado = this.normalizar(root);

        if (token.includes(rootNormalizado)) {
          this.logger.warn(`Palabra fuerte detectada: ${root}`);
          await this.registrarReporte(texto, corregido, contexto, root);

          return {
            permitido: false,
            motivo: `Lenguaje inapropiado (${root})`,
            palabra: root,
            severidad: 'strong',
          };
        }
      }
    }

    // ====== 3. NIVEL SUAVE ======
    for (const token of tokens) {
      for (const soft of this.bannedSoft) {
        const softNormalizado = this.normalizar(soft);

        if (token.includes(softNormalizado)) {
          this.logger.warn(`Palabra suave detectada: ${soft}`);
          await this.registrarReporte(texto, corregido, contexto, soft);

          return {
            permitido: true,
            advertencia: 'mantener_respecto',
            palabra: soft,
            severidad: 'soft',
          };
        }
      }
    }

    this.logger.debug('No se detectó lenguaje inapropiado.');
    return { permitido: true };
  }

  private normalizar(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private async registrarReporte(
    original: string,
    corregido: string,
    contexto: any,
    palabra: string,
  ) {
    try {
      await this.reportesService.crear({
        mensajeOriginal: original,
        mensajeCorregido: corregido,
        motivo: `Lenguaje inapropiado detectado: ${palabra}`,
        tipo: 'grosería',
        suscriptor: contexto?.usuarioId
          ? ({ id: contexto.usuarioId } as any)
          : null,
        ipUsuario: contexto?.ip || null,
        userAgent: contexto?.userAgent || null,
      });

      this.logger.warn(`Reporte de moderación guardado para palabra: ${palabra}`);
    } catch (error) {
      this.logger.error('Error al registrar reporte de moderación', error);
    }
  }
}