import { Injectable, Logger } from '@nestjs/common';
import { ReportesModeracionService } from '../../reports/reportes-moderacion/reportes-moderacion.service';

@Injectable()
export class ProfanityCheckUseCase {
  private readonly logger = new Logger(ProfanityCheckUseCase.name);

  /** Nivel fuerte → BLOQUEA */
  private readonly bannedStrong = [
    'pendej', 'put', 'mierd', 'verga', 'ching', 
    'culer', 'coño', 'matar', 'asesinar', 'golpear'
  ];

  /** Nivel suave → PERMITE PERO ADVIERTE */
  private readonly bannedSoft = [
    'idiota', 'estupido', 'estúpido', 'menso', 'tonto'
  ];

  /** Expresiones completas fuertes */
  private readonly bannedExpressions = [
    'a tu madre',
    'a su madre',
    'chinguen a su madre',
    'vete a la verga',
    'chinga tu madre'
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
  }> {

    if (!texto) return { permitido: true };

    const lower = texto.toLowerCase();

    // ====== 1. EXPRESIONES FUERTES ======
    for (const exp of this.bannedExpressions) {
      if (lower.includes(exp)) {
        await this.registrarReporte(texto, corregido, contexto, exp);
        return {
          permitido: false,
          motivo: `Lenguaje inapropiado (${exp})`,
          palabra: exp
        };
      }
    }

    const tokens = lower.split(/\s+/);

    // ====== 2. NIVEL FUERTE ======
    for (const token of tokens) {
      for (const root of this.bannedStrong) {
        if (token.includes(root)) {
          await this.registrarReporte(texto, corregido, contexto, root);
          return {
            permitido: false,
            motivo: `Lenguaje inapropiado (${root})`,
            palabra: root
          };
        }
      }
    }

    // ====== 3. NIVEL SUAVE (IDIOTA, ESTÚPIDO...) ======
    for (const token of tokens) {
      for (const soft of this.bannedSoft) {
        if (token.includes(soft)) {
          await this.registrarReporte(texto, corregido, contexto, soft);
          return {
            permitido: true,
            advertencia: 'mantener_respecto',
            palabra: soft
          };
        }
      }
    }

    return { permitido: true };
  }

  private async registrarReporte(original: string, corregido: string, contexto: any, palabra: string) {
    try {
      await this.reportesService.crear({
        mensajeOriginal: original,
        mensajeCorregido: corregido,
        motivo: `Lenguaje inapropiado detectado: ${palabra}`,
        tipo: 'grosería',
        suscriptor: contexto?.usuarioId ? ({ id: contexto.usuarioId } as any) : null,
        ipUsuario: contexto?.ip || null,
        userAgent: contexto?.userAgent || null,
      });
    } catch (error) {
      this.logger.error('❌ Error al registrar reporte de moderación', error);
    }
  }
}
