import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Connection } from 'typeorm';

@Injectable()
export class EstadisticasSemanalCronService {
  private readonly logger = new Logger(EstadisticasSemanalCronService.name);

  constructor(private readonly connection: Connection) {}

  /**
   * 🕛 Ejecuta cada domingo a medianoche
   * Calcula totales, promedios y variaciones semanales.
   */
  @Cron('0 0 * * 0') // cada domingo a medianoche
  async generarResumenSemanal() {
    const hoy = new Date();
    const domingoAnterior = new Date(hoy);
    domingoAnterior.setDate(hoy.getDate() - 7);

    const semanaInicio = domingoAnterior.toISOString().split('T')[0];
    const semanaFin = hoy.toISOString().split('T')[0];

    this.logger.log(`📊 Generando resumen semanal (${semanaInicio} → ${semanaFin})...`);

    try {
      // ✅ Obtener resumen semanal agrupado por ciudad y membresía
      const resumen = await this.connection.query(`
        SELECT 
          eh.ciudad_id,
          eh.membresia_id,
          SUM(eh.vistas) AS total_vistas,
          SUM(eh.clics) AS total_clics,
          SUM(eh.busquedas) AS total_busquedas,
          AVG(eh.vistas) AS promedio_vistas,
          AVG(eh.clics) AS promedio_clics,
          AVG(eh.busquedas) AS promedio_busquedas
        FROM estadisticas_historico eh
        WHERE fecha BETWEEN '${semanaInicio}' AND '${semanaFin}'
        GROUP BY eh.ciudad_id, eh.membresia_id
      `);

      // ✅ Insertar nuevo resumen semanal
      for (const fila of resumen) {
        // Buscar la semana anterior para calcular variaciones
        const semanaAnterior = await this.connection.query(`
          SELECT 
            total_vistas, total_clics, total_busquedas
          FROM estadisticas_resumen_semanal
          WHERE ciudad_id ${fila.ciudad_id ? `= ${fila.ciudad_id}` : 'IS NULL'}
          AND membresia_id ${fila.membresia_id ? `= ${fila.membresia_id}` : 'IS NULL'}
          ORDER BY semana_fin DESC
          LIMIT 1
        `);

        // Si hay semana anterior, calcula variaciones porcentuales
        const prev = semanaAnterior[0] || { total_vistas: 0, total_clics: 0, total_busquedas: 0 };

        const calcVar = (actual: number, anterior: number): number =>
          anterior > 0 ? Number((((actual - anterior) / anterior) * 100).toFixed(2)) : 0;

        const variacion_vistas = calcVar(fila.total_vistas, prev.total_vistas);
        const variacion_clics = calcVar(fila.total_clics, prev.total_clics);
        const variacion_busquedas = calcVar(fila.total_busquedas, prev.total_busquedas);

        // Insertar registro con totales, promedios y variaciones
        await this.connection.query(
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
            fila.ciudad_id,
            fila.membresia_id,
            fila.total_vistas,
            fila.total_clics,
            fila.total_busquedas,
            fila.promedio_vistas,
            fila.promedio_clics,
            fila.promedio_busquedas,
            variacion_vistas,
            variacion_clics,
            variacion_busquedas,
          ],
        );
      }

      this.logger.log(`✅ Resumen semanal (${semanaInicio} → ${semanaFin}) generado correctamente.`);
    } catch (error) {
      this.logger.error('❌ Error al generar resumen semanal:', error);
    }
  }
}
