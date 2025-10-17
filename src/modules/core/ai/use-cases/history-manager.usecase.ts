import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserQueryHistory } from '../../metrics/estadistica-historico/entities/user-query-history.entity';

/**
 * 🧩 Use Case: History Manager
 * Guarda las consultas del suscriptor al asistente (historial de uso).
 */
@Injectable()
export class HistoryManagerUseCase {
  private readonly logger = new Logger(HistoryManagerUseCase.name);

  constructor(
    @InjectRepository(UserQueryHistory)
    private readonly historyRepo: Repository<UserQueryHistory>,
  ) {}

  /**
   * Guarda una nueva consulta del suscriptor
   */
  async saveQuery(
    suscriptorId: number | null,
    mensajeOriginal: string,
    mensajeCorregido?: string,
    moderacion?: { resultado: 'permitido' | 'bloqueado'; palabra?: string },
    contexto?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    try {
      // 🔹 Creamos el objeto sin romper tipos
      const registro: Partial<UserQueryHistory> = {
        mensajeOriginal,
        mensajeCorregido,
        resultadoModeracion: moderacion?.resultado ?? 'permitido',
        palabraDetectada: moderacion?.palabra,
        ipUsuario: contexto?.ip,
        userAgent: contexto?.userAgent,
        suscriptor: suscriptorId ? ({ id: suscriptorId } as any) : null,
      };

      await this.historyRepo.save(registro);
      this.logger.log(`🕓 Historial guardado para suscriptor ${suscriptorId ?? 'anónimo'}`);
    } catch (error) {
      this.logger.error('❌ Error al guardar historial de consultas', error);
    }
  }

  /**
   * Obtiene las últimas consultas del suscriptor
   */
  async getRecentQueries(suscriptorId: number, limit = 5) {
    return this.historyRepo.find({
      where: { suscriptor: { id: suscriptorId } },
      order: { fechaRegistro: 'DESC' },
      take: limit,
    });
  }
}
