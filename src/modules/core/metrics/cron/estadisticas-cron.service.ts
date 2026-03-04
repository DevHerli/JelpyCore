import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class EstadisticasCronService {
  private readonly logger = new Logger(EstadisticasCronService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generarEstadisticasDiarias() {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - 1);
    const fechaStr = fecha.toISOString().split('T')[0];

    try {
      const dbRow = await this.dataSource.query(`SELECT DATABASE() AS db`);
      const dbName = dbRow?.[0]?.db ?? 'unknown';

      const tableRow = await this.dataSource.query(
        `
        SELECT COUNT(*) AS total
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name = 'membresias_negocios'
        `,
      );

      const exists = Number(tableRow?.[0]?.total || 0) > 0;

      this.logger.log(`DB actual (DATABASE()): ${dbName}`);
      this.logger.log(`Existe membresias_negocios: ${exists ? 'SI' : 'NO'}`);

      if (!exists) {
        this.logger.error(
          `No se ejecuta el CRON porque NO existe membresias_negocios en DB=${dbName}.`,
        );
        return;
      }

      const query = `
        INSERT INTO estadisticas_historico
          (fecha, negocio_id, ciudad_id, membresia_id, vistas, clics, busquedas)
        SELECT 
          DATE(?) AS fecha,
          n.id AS negocio_id,
          n.ciudad_id,
          mn.membresia_id AS membresia_id,
          COALESCE(SUM(en.vistas), 0) AS vistas,
          COALESCE(SUM(en.clics), 0) AS clics,
          COALESCE(SUM(en.busquedas), 0) AS busquedas
        FROM negocios n
        LEFT JOIN membresias_negocios mn 
               ON mn.negocio_id = n.id AND mn.activa = 1
        LEFT JOIN estadisticas_negocios en 
               ON en.negocio_id = n.id
        WHERE n.eliminado = 0
        GROUP BY n.id, n.ciudad_id, mn.membresia_id
        ON DUPLICATE KEY UPDATE
          vistas = VALUES(vistas),
          clics = VALUES(clics),
          busquedas = VALUES(busquedas),
          fecha_registro = CURRENT_TIMESTAMP
      `;

      await this.dataSource.query(query, [fechaStr]);
      this.logger.log(`Estadísticas del día ${fechaStr} actualizadas correctamente.`);
    } catch (error: any) {
      this.logger.error(`Error al generar estadísticas diarias: ${error?.message || error}`, error?.stack);
    }
  }
}