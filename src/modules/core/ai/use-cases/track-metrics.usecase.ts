import { Injectable, Logger } from '@nestjs/common';
import { EstadisticasService } from '../../metrics/estadisticas/estadisticas.service';

/**
 * 🧩 Use Case: TrackMetrics
 * Registra eventos del asistente (búsquedas, vistas, clics) en las tablas reales.
 */
@Injectable()
export class TrackMetricsUseCase {
  private readonly logger = new Logger(TrackMetricsUseCase.name);

  constructor(private readonly estadisticasService: EstadisticasService) {}

  /**
   * 🔹 Registra un evento (vista, clic, búsqueda) en las tablas reales.
   *
   * @param tipo Tipo de evento ("vista" | "clic" | "busqueda")
   * @param entidad Tipo de entidad ("negocio" | "sucursal")
   * @param id ID de la entidad
   */
  async execute(
    tipo: 'vista' | 'clic' | 'busqueda',
    entidad: 'negocio' | 'sucursal',
    id: number,
  ): Promise<void> {
    try {
      if (!id) {
        this.logger.warn(`⚠️ No se registró métrica: ID inválido`);
        return;
      }

      await this.estadisticasService.registrarEvento(tipo, entidad, id);
      this.logger.log(`📊 Evento registrado: [${tipo}] para ${entidad} #${id}`);
    } catch (error) {
      this.logger.error(`❌ Error registrando métrica`, error);
    }
  }
}
