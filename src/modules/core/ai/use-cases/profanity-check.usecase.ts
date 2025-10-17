import { Injectable, Logger } from '@nestjs/common';
import { ReportesModeracionService } from '../../reports/reportes-moderacion/reportes-moderacion.service';

/**
 * 🧩 Use Case: Detección de lenguaje inapropiado o tóxico.
 * - Revisa si un texto contiene palabras prohibidas.
 * - Registra el incidente en la tabla de reportes de moderación.
 */
@Injectable()
export class ProfanityCheckUseCase {
  private readonly logger = new Logger(ProfanityCheckUseCase.name);

  /**
   * Lista de palabras o expresiones prohibidas.
   * Puedes ampliarla según tus necesidades.
   */
  private readonly bannedWords = [
    'pendejo', 'puta', 'mierda', 'cabron', 'idiota',
    'estupido', 'verga', 'chingar', 'coño', 'culero',
    'matar', 'golpear', 'asesinar', 'violencia'
  ];

  constructor(
    private readonly reportesService: ReportesModeracionService,
  ) {}

  /**
   * Analiza un texto, detecta groserías y registra un reporte si es necesario.
   *
   * @param texto Texto original del usuario
   * @param corregido Texto corregido (opcional)
   * @param contexto Información adicional (IP, user-agent, usuarioId, etc.)
   */
  async execute(
    texto: string,
    corregido?: string,
    contexto?: { ip?: string; userAgent?: string; usuarioId?: number },
  ): Promise<{ permitido: boolean; motivo?: string; palabra?: string }> {
    if (!texto) {
      return { permitido: true };
    }

    const lower = texto.toLowerCase();
    const palabra = this.bannedWords.find(w => lower.includes(w));

    if (palabra) {
      try {
        // 🧠 Registrar el incidente en la base de datos
        await this.reportesService.crear({
          mensajeOriginal: texto,
          mensajeCorregido: corregido,
          motivo: `Lenguaje inapropiado detectado: ${palabra}`,
          tipo: 'grosería',
          // ✅ Guardamos la relación con el suscriptor (foreign key)
          suscriptor: contexto?.usuarioId ? ({ id: contexto.usuarioId } as any) : null,
          ipUsuario: contexto?.ip || null,
          userAgent: contexto?.userAgent || null,
        });

        this.logger.warn(`⚠️ Grosería detectada: "${palabra}"`);
      } catch (error) {
        this.logger.error('❌ Error al registrar reporte de moderación', error);
      }

      return {
        permitido: false,
        motivo: `Lenguaje inapropiado detectado (${palabra})`,
        palabra,
      };
    }

    // ✅ Si no se detectan palabras prohibidas
    return { permitido: true };
  }
}
