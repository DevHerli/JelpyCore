import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class EstadisticasSemanalCronService {
  private readonly logger = new Logger(EstadisticasSemanalCronService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron('0 0 * * 0')
  async generarResumenSemanal() {
    const hoy = new Date();

    const fin = new Date(hoy);
    fin.setHours(0, 0, 0, 0);

    const inicio = new Date(fin);
    inicio.setDate(inicio.getDate() - 7);

    const semanaInicio = inicio.toISOString().split('T')[0];
    const semanaFin = fin.toISOString().split('T')[0];

    this.logger.log(`Generando resumen semanal (${semanaInicio} → ${semanaFin})...`);

    try {
      const dbRow = await this.dataSource.query(`SELECT DATABASE() AS db`);
      const dbName = dbRow?.[0]?.db ?? 'unknown';
      this.logger.log(`DB actual (DATABASE()): ${dbName}`);

      const resumen = await this.dataSource.query(
        `
        SELECT 
          eh.ciudad_id AS ciudad_id,
          eh.membresia_id AS membresia_id,
          SUM(eh.vistas) AS total_vistas,
          SUM(eh.clics) AS total_clics,
          SUM(eh.busquedas) AS total_busquedas,
          AVG(eh.vistas) AS promedio_vistas,
          AVG(eh.clics) AS promedio_clics,
          AVG(eh.busquedas) AS promedio_busquedas
        FROM estadisticas_historico eh
        WHERE eh.fecha >= ? AND eh.fecha < ?
        GROUP BY eh.ciudad_id, eh.membresia_id
        `,
        [semanaInicio, semanaFin],
      );

      if (!Array.isArray(resumen) || resumen.length === 0) {
        this.logger.log(`Sin datos en estadisticas_historico para el rango ${semanaInicio} → ${semanaFin}.`);
        return;
      }

      const calcVar = (actual: number, anterior: number): number =>
        anterior > 0 ? Number((((actual - anterior) / anterior) * 100).toFixed(2)) : 0;

      for (const fila of resumen) {
        const ciudadId =
          fila.ciudad_id === null || fila.ciudad_id === undefined ? null : Number(fila.ciudad_id);
        const membresiaId =
          fila.membresia_id === null || fila.membresia_id === undefined ? null : Number(fila.membresia_id);

        const totalVistas = Number(fila.total_vistas || 0);
        const totalClics = Number(fila.total_clics || 0);
        const totalBusquedas = Number(fila.total_busquedas || 0);

        const promedioVistas = Number(fila.promedio_vistas || 0);
        const promedioClics = Number(fila.promedio_clics || 0);
        const promedioBusquedas = Number(fila.promedio_busquedas || 0);

        const prevArr = await this.dataSource.query(
          `
          SELECT 
            total_vistas, total_clics, total_busquedas
          FROM estadisticas_resumen_semanal
          WHERE (ciudad_id <=> ?) AND (membresia_id <=> ?)
          ORDER BY semana_fin DESC
          LIMIT 1
          `,
          [ciudadId, membresiaId],
        );

        const prev = prevArr?.[0] ?? { total_vistas: 0, total_clics: 0, total_busquedas: 0 };

        const variacionVistas = calcVar(totalVistas, Number(prev.total_vistas || 0));
        const variacionClics = calcVar(totalClics, Number(prev.total_clics || 0));
        const variacionBusquedas = calcVar(totalBusquedas, Number(prev.total_busquedas || 0));

        await this.dataSource.query(
          `
          INSERT INTO estadisticas_resumen_semanal (
            semana_inicio, semana_fin, ciudad_id, membresia_id,
            total_vistas, total_clics, total_busquedas,
            promedio_vistas, promedio_clics, promedio_busquedas,
            variacion_vistas, variacion_clics, variacion_busquedas
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            semanaInicio,
            semanaFin,
            ciudadId,
            membresiaId,
            totalVistas,
            totalClics,
            totalBusquedas,
            promedioVistas,
            promedioClics,
            promedioBusquedas,
            variacionVistas,
            variacionClics,
            variacionBusquedas,
          ],
        );
      }

      this.logger.log(`Resumen semanal (${semanaInicio} → ${semanaFin}) generado correctamente.`);
    } catch (error: any) {
      this.logger.error(`Error al generar resumen semanal: ${error?.message || error}`, error?.stack);
    }
  }
}