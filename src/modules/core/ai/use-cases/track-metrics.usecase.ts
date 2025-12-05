import { Injectable, Logger } from '@nestjs/common';
import { EstadisticasService } from '../../metrics/estadisticas/estadisticas.service';

@Injectable()
export class TrackMetricsUseCase {
  private readonly logger = new Logger(TrackMetricsUseCase.name);

  constructor(private readonly estadisticasService: EstadisticasService) {}

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

      this.logger.log(`📊 Evento registrado: [${tipo}] ${entidad}#${id}`);
    } catch (error) {
      this.logger.error(`❌ Error registrando métrica`, error);
    }
  }
}
