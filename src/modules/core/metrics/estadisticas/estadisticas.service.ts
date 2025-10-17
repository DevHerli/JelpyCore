import { Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';

@Injectable()
export class EstadisticasService {
  constructor(private readonly connection: Connection) {}

  /**
   * 🔹 Registrar evento genérico (vistas, clics, búsqueda)
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
   * 🔹 Obtener métricas resumidas de negocios
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
   * 🔹 Obtener métricas resumidas de sucursales
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
   * 🔹 Resumen global del sistema (Dashboard principal)
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

    // 🔹 Métricas agrupadas por tipo de membresía
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
}
