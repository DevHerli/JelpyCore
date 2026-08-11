import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';

// JLP-M24: contexto del solicitante para verificar propiedad del negocio.
export type RequesterCtx = { sub: number; isAdmin: boolean };

@Injectable()
export class EstadisticasService {
  constructor(private readonly connection: Connection) {}

  /**
   * JLP-M24: verifica que el solicitante sea dueño del negocio (o admin)
   * antes de exponer métricas (evita que un competidor lea el tráfico ajeno).
   */
  private async assertOwnershipNegocio(
    negocioId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester || requester.isAdmin) return;
    const rows = await this.connection.query(
      `SELECT suscriptor_id FROM negocios WHERE id = ? LIMIT 1`,
      [negocioId],
    );
    if (!rows.length) {
      throw new NotFoundException('Negocio no encontrado');
    }
    if (Number(rows[0].suscriptor_id) !== requester.sub) {
      throw new ForbiddenException('No tienes permiso sobre este negocio');
    }
  }

  /**
   * Registrar evento genérico (vistas, clics, búsqueda)
   */
  async registrarEvento(
    tipo: 'vista' | 'clic' | 'busqueda',
    entidad: 'negocio' | 'sucursal',
    id: number,
  ) {
    const tabla =
      entidad === 'negocio'
        ? 'estadisticas_negocios'
        : 'estadisticas_sucursales';

    const campo =
      tipo === 'vista'
        ? 'vistas'
        : tipo === 'clic'
        ? 'clics'
        : 'busquedas';

    const existe = await this.connection.query(
      `SELECT id FROM ${tabla} WHERE ${entidad}_id = ? LIMIT 1`,
      [id],
    );

    if (existe.length > 0) {
      await this.connection.query(
        `UPDATE ${tabla} SET ${campo} = ${campo} + 1 WHERE ${entidad}_id = ?`,
        [id],
      );
    } else {
      const columnas = `${entidad}_id, ${campo}`;
      await this.connection.query(
        `INSERT INTO ${tabla} (${columnas}) VALUES (?, 1)`,
        [id],
      );
    }

    return { message: `${tipo} registrada para ${entidad} ${id}` };
  }

  /**
   * Obtener métricas resumidas de negocios
   */
  async resumenNegocios() {
    const data = await this.connection.query(`
      SELECT 
        n.id,
        n.nombre_negocio,
        c.nombre AS categoria,
        COALESCE(SUM(e.vistas),0) AS vistas,
        COALESCE(SUM(e.clics),0) AS clics,
        COALESCE(SUM(e.busquedas),0) AS busquedas
      FROM negocios n
      LEFT JOIN estadisticas_negocios e ON e.negocio_id = n.id
      LEFT JOIN categorias c ON n.categoria_id = c.id
      GROUP BY n.id, n.nombre_negocio, c.nombre
      ORDER BY vistas DESC
      LIMIT 10
    `);
    return { fecha: new Date(), negocios: data };
  }

  /**
   * Obtener métricas resumidas de sucursales
   */
  async resumenSucursales() {
    const data = await this.connection.query(`
      SELECT 
        s.id,
        s.nombre_sucursal,
        n.nombre_negocio,
        COALESCE(SUM(e.vistas),0) AS vistas,
        COALESCE(SUM(e.clics),0) AS clics,
        COALESCE(SUM(e.busquedas),0) AS busquedas
      FROM sucursales_negocios s
      LEFT JOIN estadisticas_sucursales e ON e.sucursal_id = s.id
      LEFT JOIN negocios n ON s.negocio_id = n.id
      GROUP BY s.id, s.nombre_sucursal, n.nombre_negocio
      ORDER BY vistas DESC
      LIMIT 10
    `);
    return { fecha: new Date(), sucursales: data };
  }

  /**
   * Resumen global del sistema (Dashboard principal)
   */
  async resumenGlobal(filtros?: { ciudadId?: number; fechaInicio?: string; fechaFin?: string }) {
    const { ciudadId, fechaInicio, fechaFin } = filtros || {};

    // Filtros dinámicos
    const filtroCiudadNegocios = ciudadId ? `AND n.ciudad_id = ${ciudadId}` : '';
    const filtroCiudadSucursales = ciudadId ? `AND s.ciudad_id = ${ciudadId}` : '';
    const filtroFecha = fechaInicio && fechaFin 
      ? `AND DATE(e.fecha_registro) BETWEEN '${fechaInicio}' AND '${fechaFin}'` 
      : '';

    // Totales generales (respetando filtros)
    const totales = await this.connection.query(`
      SELECT 
        (SELECT COUNT(*) FROM suscriptores WHERE eliminado = 0) AS totalSuscriptores,
        (SELECT COUNT(*) FROM negocios n WHERE eliminado = 0 ${filtroCiudadNegocios}) AS totalNegocios,
        (SELECT COUNT(*) FROM sucursales_negocios s WHERE eliminado = 0 ${filtroCiudadSucursales}) AS totalSucursales,
        (SELECT COUNT(*) FROM promociones_sucursales p 
            INNER JOIN sucursales_negocios s ON s.id = p.sucursal_id
            WHERE p.eliminado = 0 AND p.activa = 1 ${filtroCiudadSucursales}) AS totalPromociones
    `);

    // Negocios más buscados
    const negociosMasBuscados = await this.connection.query(`
      SELECT 
        n.id,
        n.nombre_negocio,
        c.nombre AS categoria,
        COALESCE(SUM(e.busquedas), 0) AS busquedas
      FROM negocios n
      LEFT JOIN estadisticas_negocios e ON e.negocio_id = n.id
      LEFT JOIN categorias c ON c.id = n.categoria_id
      WHERE n.eliminado = 0 ${filtroCiudadNegocios} ${filtroFecha}
      GROUP BY n.id, n.nombre_negocio, c.nombre
      ORDER BY busquedas DESC
      LIMIT 5
    `);

    // Promociones más vistas
    const promocionesMasVistas = await this.connection.query(`
      SELECT 
        p.id,
        p.titulo,
        s.nombre_sucursal AS sucursal,
        n.nombre_negocio AS negocio,
        COALESCE(SUM(ep.vistas), 0) AS vistas
      FROM promociones_sucursales p
      LEFT JOIN estadisticas_promociones ep ON ep.promocion_id = p.id
      LEFT JOIN sucursales_negocios s ON p.sucursal_id = s.id
      LEFT JOIN negocios n ON s.negocio_id = n.id
      WHERE p.eliminado = 0 ${filtroCiudadSucursales} ${filtroFecha}
      GROUP BY p.id, p.titulo, s.nombre_sucursal, n.nombre_negocio
      ORDER BY vistas DESC
      LIMIT 5
    `);

    // Sucursales más activas
    const sucursalesMasActivas = await this.connection.query(`
      SELECT 
        s.id,
        s.nombre_sucursal,
        n.nombre_negocio,
        COUNT(p.id) AS totalPromociones
      FROM sucursales_negocios s
      LEFT JOIN promociones_sucursales p ON s.id = p.sucursal_id
      LEFT JOIN negocios n ON s.negocio_id = n.id
      WHERE s.eliminado = 0 AND p.eliminado = 0 AND p.activa = 1
      ${filtroCiudadSucursales}
      GROUP BY s.id, s.nombre_sucursal, n.nombre_negocio
      ORDER BY totalPromociones DESC
      LIMIT 5
    `);

    // Métricas agrupadas por tipo de membresía
    const resumenPorMembresia = await this.connection.query(`
      SELECT 
        m.id,
        m.nombre AS nombre_membresia,
        COUNT(n.id) AS total_negocios,
        COALESCE(SUM(e.vistas), 0) AS vistas,
        COALESCE(SUM(e.clics), 0) AS clics,
        COALESCE(SUM(e.busquedas), 0) AS busquedas
      FROM membresias m
      LEFT JOIN negocios n ON n.membresia_id = m.id AND n.eliminado = 0
      LEFT JOIN estadisticas_negocios e ON e.negocio_id = n.id
      GROUP BY m.id, m.nombre
      ORDER BY m.id ASC
    `);

    return {
      filtros: {
        ciudadId: ciudadId || null,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
      },
      fechaGeneracion: new Date(),
      totales: totales[0],
      top: {
        negociosMasBuscados,
        promocionesMasVistas,
        sucursalesMasActivas,
      },
      membresias: resumenPorMembresia,
    };
  }

  /**
   * Obtener KPIs ligeros (totales) de una sucursal específica
   */
  async getKpisSucursal(sucursalId: number) {
    const res = await this.connection.query(
      `SELECT
         COALESCE(vistas, 0) as vistas,
         COALESCE(clics, 0) as clics,
         COALESCE(busquedas, 0) as busquedas
       FROM estadisticas_sucursales
       WHERE sucursal_id = ?
       LIMIT 1`,
      [sucursalId],
    );

    // Si no hay registros aún, devolvemos ceros
    return res[0] || { vistas: 0, clics: 0, busquedas: 0 };
  }

  /**
   * Métricas globales de un negocio — usado en la sección business/global-metrics/:id
   * Agrega: info del negocio, estadísticas por sucursal, likes, promociones, tendencia mensual
   */
  async getGlobalMetricsNegocio(negocioId: number, requester?: RequesterCtx) {
    // JLP-M24: solo el dueño del negocio (o admin) puede ver sus métricas.
    await this.assertOwnershipNegocio(negocioId, requester);

    // 1. Info básica del negocio
    const negocioInfo = await this.connection.query(
      `SELECT
         n.id,
         n.nombre_negocio,
         n.logo_url,
         n.descripcion,
         n.activo,
         c.nombre AS categoria,
         ci.nombre AS ciudad
       FROM negocios n
       LEFT JOIN categorias c ON c.id = n.categoria_id
       LEFT JOIN ciudades ci ON ci.id = n.ciudad_id
       WHERE n.id = ? AND n.eliminado = 0
       LIMIT 1`,
      [negocioId],
    );

    if (!negocioInfo.length) {
      return { error: 'Negocio no encontrado', negocioId };
    }

    // 2. Estadísticas globales a nivel negocio
    const statsNegocio = await this.connection.query(
      `SELECT
         COALESCE(vistas, 0)    AS vistas,
         COALESCE(clics, 0)     AS clics,
         COALESCE(busquedas, 0) AS busquedas
       FROM estadisticas_negocios
       WHERE negocio_id = ?
       LIMIT 1`,
      [negocioId],
    );

    // 3. Estadísticas por sucursal + likes + promociones activas
    const sucursalesStats = await this.connection.query(
      `SELECT
         s.id                                           AS sucursalId,
         s.nombre_sucursal                              AS nombre,
         s.activo,
         COALESCE(es.vistas, 0)                         AS vistas,
         COALESCE(es.clics, 0)                          AS clics,
         COALESCE(es.busquedas, 0)                      AS busquedas,
         COALESCE(lk.total_likes, 0)                    AS likes,
         COALESCE(pr.total_promociones, 0)              AS promocionesActivas
       FROM sucursales_negocios s
       LEFT JOIN estadisticas_sucursales es
              ON es.sucursal_id = s.id
       LEFT JOIN (
           SELECT sucursal_id, COUNT(id) AS total_likes
           FROM sucursal_likes
           GROUP BY sucursal_id
       ) lk ON lk.sucursal_id = s.id
       LEFT JOIN (
           SELECT sucursal_id, COUNT(id) AS total_promociones
           FROM promociones_sucursales
           WHERE eliminado = 0 AND activa = 1
           GROUP BY sucursal_id
       ) pr ON pr.sucursal_id = s.id
       WHERE s.negocio_id = ? AND s.eliminado = 0
       ORDER BY busquedas DESC`,
      [negocioId],
    );

    // 4. Totales consolidados
    const totales = sucursalesStats.reduce(
      (acc: any, s: any) => {
        acc.totalVistas     += Number(s.vistas);
        acc.totalClics      += Number(s.clics);
        acc.totalBusquedas  += Number(s.busquedas);
        acc.totalLikes      += Number(s.likes);
        acc.totalPromociones += Number(s.promocionesActivas);
        return acc;
      },
      { totalVistas: 0, totalClics: 0, totalBusquedas: 0, totalLikes: 0, totalPromociones: 0 },
    );

    // 5. Tendencia mensual de búsquedas (últimos 6 meses) por sucursales del negocio
    const tendenciaMensual = await this.connection.query(
      `SELECT
         DATE_FORMAT(esh.fecha, '%Y-%m') AS mes,
         SUM(COALESCE(esh.busquedas, 0)) AS busquedas,
         SUM(COALESCE(esh.vistas, 0))    AS vistas
       FROM estadisticas_sucursales_historico esh
       INNER JOIN sucursales_negocios s ON s.id = esh.sucursal_id
       WHERE s.negocio_id = ?
         AND esh.fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY mes
       ORDER BY mes ASC`,
      [negocioId],
    ).catch(() => []); // Si la tabla no existe en este entorno, retorna vacío

    // 6. Sucursal estrella (la más buscada)
    const sucursalEstrella = sucursalesStats.length > 0 ? sucursalesStats[0] : null;

    return {
      fechaGeneracion: new Date(),
      negocio: negocioInfo[0],
      statsNegocio: statsNegocio[0] || { vistas: 0, clics: 0, busquedas: 0 },
      totales: {
        sucursales: sucursalesStats.length,
        ...totales,
      },
      sucursalEstrella,
      sucursales: sucursalesStats,
      tendenciaMensual,
    };
  }

}
