import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection } from 'typeorm';

@Injectable()
export class EstadisticasCronService {
  private readonly logger = new Logger(EstadisticasCronService.name);

  constructor(private readonly connection: Connection) {}

  // Ejecuta cada día a las 2 AM
  // @Cron(CronExpression.EVERY_MINUTE)
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generarEstadisticasDiarias() {
    this.logger.log('⏰ Iniciando actualización de estadísticas diarias...');

    const fecha = new Date();
    fecha.setDate(fecha.getDate() - 1); // día anterior
    const fechaStr = fecha.toISOString().split('T')[0];

    try {
      const query = `
        INSERT INTO estadisticas_historico (fecha, negocio_id, ciudad_id, membresia_id, vistas, clics, busquedas)
        SELECT 
          DATE('${fechaStr}') AS fecha,
          n.id AS negocio_id,
          n.ciudad_id,
          n.membresia_id,
          COALESCE(SUM(en.vistas), 0) AS vistas,
          COALESCE(SUM(en.clics), 0) AS clics,
          COALESCE(SUM(en.busquedas), 0) AS busquedas
        FROM negocios n
        LEFT JOIN estadisticas_negocios en ON en.negocio_id = n.id
        WHERE n.eliminado = 0
        GROUP BY n.id, n.ciudad_id, n.membresia_id
        ON DUPLICATE KEY UPDATE
          vistas = VALUES(vistas),
          clics = VALUES(clics),
          busquedas = VALUES(busquedas),
          fecha_registro = CURRENT_TIMESTAMP;
      `;

      await this.connection.query(query);
      this.logger.log(`✅ Estadísticas del día ${fechaStr} actualizadas correctamente.`);
    } catch (error) {
      this.logger.error('❌ Error al generar estadísticas diarias:', error);
    }
  }
}
