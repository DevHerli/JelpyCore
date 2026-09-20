import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'typeorm';

// JLP-M24: contexto del solicitante para verificar propiedad del negocio.
export type RequesterCtx = { sub: number; isAdmin: boolean };

// METRICS-001: tipos de evento soportados por el tracking de estadísticas.
// 'llamada' / 'whatsapp' / 'como_llegar' son la conversión ORGÁNICA (usuario
// llega por búsqueda/categoría/chat de Jelpy, sin click de anuncio) — se
// registran en paralelo (dual-fire) a la conversión de ads cuando SÍ hay
// atribución de campaña. Ver business-details.modal.ts (frontend).
export type TipoEventoEstadistica =
  | 'vista'
  | 'clic'
  | 'favorito'
  | 'busqueda'
  | 'llamada'
  | 'whatsapp'
  | 'como_llegar';

export const TIPOS_EVENTO_ESTADISTICA: TipoEventoEstadistica[] = [
  'vista',
  'clic',
  'favorito',
  'busqueda',
  'llamada',
  'whatsapp',
  'como_llegar',
];

// Mapa explícito tipo → columna. Reemplaza la cadena de ternarios previa
// (`tipo === 'vista' ? 'vistas' : tipo === 'clic' ? 'clics' : 'busquedas'`)
// que degradaba SILENCIOSAMENTE cualquier tipo desconocido a `busquedas` —
// bug latente nunca disparado porque antes solo existían 3 tipos válidos.
const CAMPO_POR_TIPO: Partial<Record<TipoEventoEstadistica, string>> = {
  vista: 'vistas',
  clic: 'clics',
  busqueda: 'busquedas',
  llamada: 'llamadas',
  whatsapp: 'whatsapp',
  como_llegar: 'direcciones',
};

const ORIGENES_ESTADISTICA = new Set([
  'chat',
  'home',
  'search',
  'category',
  'promotions',
  'business_detail',
  'ads',
  'unknown',
]);

export type DetalleEventoEstadistica = {
  origen?: string | null;
  superficie?: string | null;
  termino?: string | null;
  ciudadId?: number | null;
  ciudadNombre?: string | null;
  categoriaId?: number | null;
  categoriaNombre?: string | null;
  subcategoriaId?: number | null;
  subcategoriaNombre?: string | null;
  especialidadId?: number | null;
  especialidadNombre?: string | null;
  negocioId?: number | null;
  sucursalId?: number | null;
  resultados?: number | null;
  sinResultados?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

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

  private async assertOwnershipSucursal(
    sucursalId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester) return;

    const rows = await this.connection.query(
      `SELECT id, negocio_id FROM sucursales_negocios WHERE id = ? AND eliminado = 0 LIMIT 1`,
      [sucursalId],
    );
    if (!rows.length) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    await this.assertOwnershipNegocio(Number(rows[0].negocio_id), requester);
  }

  /**
   * Registrar evento genérico (vistas, clics, búsqueda, y desde METRICS-001
   * también llamadas/whatsapp/como_llegar — conversión orgánica).
   *
   * METRICS-001: pasado a upsert atómico (`INSERT ... ON DUPLICATE KEY
   * UPDATE`) — reemplaza el patrón previo SELECT→INSERT/UPDATE, que era
   * racy bajo concurrencia (dos requests casi simultáneos para el mismo
   * negocio/sucursal podían ambos ver "no existe" e intentar INSERT, o
   * perder un incremento). Requiere el UNIQUE KEY sobre negocio_id /
   * sucursal_id agregado en migrations/metrics_001_conversion_organica.sql.
   */
  async registrarEvento(
    tipo: TipoEventoEstadistica,
    entidad: 'negocio' | 'sucursal',
    id: number,
    detalle?: DetalleEventoEstadistica,
  ) {
    const tabla =
      entidad === 'negocio'
        ? 'estadisticas_negocios'
        : 'estadisticas_sucursales';

    const campo = CAMPO_POR_TIPO[tipo];
    if (!TIPOS_EVENTO_ESTADISTICA.includes(tipo)) {
      // Defensa en profundidad: el controller ya valida contra la whitelist,
      // pero el service no debe confiar ciegamente en el caller (también lo
      // invoca TrackMetricsUseCase directamente).
      throw new BadRequestException(`Tipo de evento inválido: ${tipo}`);
    }

    if (campo) {
      await this.connection.query(
        `INSERT INTO ${tabla} (${entidad}_id, ${campo}) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE ${campo} = ${campo} + 1`,
        [id],
      );
    }

    await this.registrarEventoDetallado(tipo, entidad, id, detalle);

    return { message: `${tipo} registrada para ${entidad} ${id}` };
  }

  async registrarBusquedaSinResultados(detalle: DetalleEventoEstadistica) {
    if (!detalle.termino?.trim()) {
      throw new BadRequestException('El término de búsqueda es obligatorio');
    }
    if (!detalle.origen?.trim()) {
      throw new BadRequestException('El origen es obligatorio');
    }

    const entidad: 'negocio' | 'sucursal' = detalle.sucursalId ? 'sucursal' : 'negocio';
    const id = Number(detalle.sucursalId ?? detalle.negocioId ?? 0);

    await this.registrarEventoDetallado('busqueda', entidad, id, {
      ...detalle,
      resultados: 0,
      sinResultados: true,
    });

    return { message: 'Búsqueda sin resultados registrada' };
  }

  private async registrarEventoDetallado(
    tipo: TipoEventoEstadistica,
    entidad: 'negocio' | 'sucursal',
    id: number,
    detalle?: DetalleEventoEstadistica,
  ): Promise<void> {
    const sucursalId = this.toNumberOrNull(detalle?.sucursalId ?? (entidad === 'sucursal' ? id : null));
    const negocioId = this.toNumberOrNull(detalle?.negocioId ?? (entidad === 'negocio' ? id : null));
    const entidadId = this.toNumberOrNull(id);
    const metadata = detalle?.metadata ? JSON.stringify(detalle.metadata) : null;

    await this.connection.query(
      `INSERT INTO estadisticas_eventos (
         tipo, entidad, entidad_id, origen, superficie, termino,
         ciudad_id, ciudad_nombre, categoria_id, categoria_nombre,
         subcategoria_id, subcategoria_nombre, especialidad_id, especialidad_nombre,
         negocio_id, sucursal_id,
         resultados, sin_resultados, metadata
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo,
        entidad,
        entidadId,
        this.normalizeOrigen(detalle?.origen),
        this.truncate(detalle?.superficie, 80),
        this.truncate(detalle?.termino, 255),
        this.toNumberOrNull(detalle?.ciudadId),
        this.truncate(detalle?.ciudadNombre, 120),
        this.toNumberOrNull(detalle?.categoriaId),
        this.truncate(detalle?.categoriaNombre, 160),
        this.toNumberOrNull(detalle?.subcategoriaId),
        this.truncate(detalle?.subcategoriaNombre, 160),
        this.toNumberOrNull(detalle?.especialidadId),
        this.truncate(detalle?.especialidadNombre, 160),
        negocioId,
        sucursalId,
        Math.max(0, Number(detalle?.resultados ?? 0) || 0),
        detalle?.sinResultados ? 1 : 0,
        metadata,
      ],
    );
  }

  async getDesgloseSucursal(sucursalId: number, requester?: RequesterCtx) {
    await this.assertOwnershipSucursal(sucursalId, requester);

    const [
      porOrigenRows,
      busquedasSinResultado,
      categoriasMasBuscadas,
      subcategoriasMasBuscadas,
      especialidadesMasBuscadas,
      ciudadesMasBuscadas,
    ] =
      await Promise.all([
        this.connection.query(
          `SELECT tipo, COALESCE(origen, 'unknown') AS origen, COUNT(*) AS total
             FROM estadisticas_eventos
            WHERE sucursal_id = ?
              AND sin_resultados = 0
            GROUP BY tipo, COALESCE(origen, 'unknown')
            ORDER BY tipo ASC, total DESC`,
          [sucursalId],
        ),
        this.connection.query(
          `SELECT termino, COALESCE(origen, 'unknown') AS origen, COUNT(*) AS total
             FROM estadisticas_eventos
            WHERE sucursal_id = ?
              AND tipo = 'busqueda'
              AND sin_resultados = 1
              AND termino IS NOT NULL
            GROUP BY termino, COALESCE(origen, 'unknown')
            ORDER BY total DESC, termino ASC
            LIMIT 20`,
          [sucursalId],
        ),
        this.connection.query(
          `SELECT categoria_id AS id, categoria_nombre AS nombre, COUNT(*) AS total
             FROM estadisticas_eventos
            WHERE sucursal_id = ?
              AND tipo = 'busqueda'
              AND categoria_id IS NOT NULL
            GROUP BY categoria_id, categoria_nombre
            ORDER BY total DESC
            LIMIT 10`,
          [sucursalId],
        ),
        this.connection.query(
          `SELECT subcategoria_id AS id, subcategoria_nombre AS nombre, COUNT(*) AS total
             FROM estadisticas_eventos
            WHERE sucursal_id = ?
              AND tipo = 'busqueda'
              AND subcategoria_id IS NOT NULL
            GROUP BY subcategoria_id, subcategoria_nombre
            ORDER BY total DESC
            LIMIT 10`,
          [sucursalId],
        ),
        this.connection.query(
          `SELECT especialidad_id AS id, especialidad_nombre AS nombre, COUNT(*) AS total
             FROM estadisticas_eventos
            WHERE sucursal_id = ?
              AND tipo = 'busqueda'
              AND especialidad_id IS NOT NULL
            GROUP BY especialidad_id, especialidad_nombre
            ORDER BY total DESC
            LIMIT 10`,
          [sucursalId],
        ),
        this.connection.query(
          `SELECT ciudad_id AS id, ciudad_nombre AS nombre, COUNT(*) AS total
             FROM estadisticas_eventos
            WHERE sucursal_id = ?
              AND tipo = 'busqueda'
              AND ciudad_id IS NOT NULL
            GROUP BY ciudad_id, ciudad_nombre
            ORDER BY total DESC
            LIMIT 10`,
          [sucursalId],
        ),
      ]);

    return {
      porOrigen: this.formatearPorOrigen(porOrigenRows),
      busquedasSinResultado: busquedasSinResultado.map((row: any) => ({
        termino: row.termino,
        total: Number(row.total),
        origen: row.origen,
      })),
      categoriasMasBuscadas: categoriasMasBuscadas.map((row: any) => ({
        id: Number(row.id),
        nombre: row.nombre,
        total: Number(row.total),
      })),
      subcategoriasMasBuscadas: subcategoriasMasBuscadas.map((row: any) => ({
        id: Number(row.id),
        nombre: row.nombre,
        total: Number(row.total),
      })),
      especialidadesMasBuscadas: especialidadesMasBuscadas.map((row: any) => ({
        id: Number(row.id),
        nombre: row.nombre,
        total: Number(row.total),
      })),
      ciudadesMasBuscadas: ciudadesMasBuscadas.map((row: any) => ({
        id: Number(row.id),
        nombre: row.nombre,
        total: Number(row.total),
      })),
    };
  }

  private formatearPorOrigen(rows: any[]) {
    const result = {
      busquedas: [] as Array<{ origen: string; total: number }>,
      vistas: [] as Array<{ origen: string; total: number }>,
      clics: [] as Array<{ origen: string; total: number }>,
      favoritos: [] as Array<{ origen: string; total: number }>,
      llamadas: [] as Array<{ origen: string; total: number }>,
      whatsapp: [] as Array<{ origen: string; total: number }>,
      direcciones: [] as Array<{ origen: string; total: number }>,
      como_llegar: [] as Array<{ origen: string; total: number }>,
    };

    const keyByTipo: Record<string, keyof typeof result> = {
      busqueda: 'busquedas',
      vista: 'vistas',
      clic: 'clics',
      favorito: 'favoritos',
      llamada: 'llamadas',
      whatsapp: 'whatsapp',
      como_llegar: 'como_llegar',
    };

    for (const row of rows) {
      const key = keyByTipo[row.tipo];
      if (!key) continue;
      const item = {
        origen: row.origen,
        total: Number(row.total),
      };
      result[key].push(item);
      if (row.tipo === 'como_llegar') {
        result.direcciones.push(item);
      }
    }

    return result;
  }

  private normalizeOrigen(value: unknown): string {
    const normalized = this.truncate(value, 40) ?? 'unknown';
    return ORIGENES_ESTADISTICA.has(normalized) ? normalized : 'unknown';
  }

  private truncate(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text.substring(0, max) : null;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
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

    // JLP-SEC: fechaInicio/fechaFin llegaban del querystring y se
    // concatenaban crudas en el SQL (`BETWEEN '${fechaInicio}' AND
    // '${fechaFin}'`) — inyección SQL confirmada contra producción con una
    // prueba inerte (comilla simple → error de sintaxis, errno 1064, sin
    // extraer datos). Invisible hasta hoy porque este endpoint exige
    // AdminGuard y no existía ningún admin en producción. ciudadId ya llegaba
    // como Number() desde el controller y no era inyectable, pero se
    // parametriza también por consistencia.
    const filtroCiudadNegocios = ciudadId ? `AND n.ciudad_id = ?` : '';
    const filtroCiudadSucursales = ciudadId ? `AND s.ciudad_id = ?` : '';
    const paramsFecha = fechaInicio && fechaFin ? [fechaInicio, fechaFin] : [];
    // Bug preexistente (independiente de la inyección): el filtro de fecha
    // estaba hardcodeado a `e.fecha_registro`, pero cada query usa un alias
    // distinto para su tabla de estadísticas (`e` en negociosMasBuscados,
    // `ep` en promocionesMasVistas). Con el alias equivocado, CUALQUIER
    // llamada con fecha_inicio+fecha_fin válidas —sin inyectar nada— tronaba
    // con 1054 Unknown column. Nunca se detectó por la misma razón que las
    // demás: sin admin en producción, nadie llegaba a probarlo. Se separa un
    // filtro por alias real.
    const filtroFechaNegocios = fechaInicio && fechaFin ? `AND DATE(e.fecha_registro) BETWEEN ? AND ?` : '';
    const filtroFechaPromos = fechaInicio && fechaFin ? `AND DATE(ep.fecha_registro) BETWEEN ? AND ?` : '';

    // Totales generales (respetando filtros)
    const totales = await this.connection.query(
      `
      SELECT
        (SELECT COUNT(*) FROM suscriptores WHERE eliminado = 0) AS totalSuscriptores,
        (SELECT COUNT(*) FROM negocios n WHERE eliminado = 0 ${filtroCiudadNegocios}) AS totalNegocios,
        (SELECT COUNT(*) FROM sucursales_negocios s WHERE eliminado = 0 ${filtroCiudadSucursales}) AS totalSucursales,
        (SELECT COUNT(*) FROM promociones_sucursales p
            INNER JOIN sucursales_negocios s ON s.id = p.sucursal_id
            WHERE p.eliminado = 0 AND p.activa = 1 ${filtroCiudadSucursales}) AS totalPromociones
    `,
      [
        ...(ciudadId ? [ciudadId] : []),
        ...(ciudadId ? [ciudadId] : []),
        ...(ciudadId ? [ciudadId] : []),
      ],
    );

    // Negocios más buscados
    const negociosMasBuscados = await this.connection.query(
      `
      SELECT
        n.id,
        n.nombre_negocio,
        c.nombre AS categoria,
        COALESCE(SUM(e.busquedas), 0) AS busquedas
      FROM negocios n
      LEFT JOIN estadisticas_negocios e ON e.negocio_id = n.id
      LEFT JOIN categorias c ON c.id = n.categoria_id
      WHERE n.eliminado = 0 ${filtroCiudadNegocios} ${filtroFechaNegocios}
      GROUP BY n.id, n.nombre_negocio, c.nombre
      ORDER BY busquedas DESC
      LIMIT 5
    `,
      [...(ciudadId ? [ciudadId] : []), ...paramsFecha],
    );

    // Promociones más vistas
    const promocionesMasVistas = await this.connection.query(
      `
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
      WHERE p.eliminado = 0 ${filtroCiudadSucursales} ${filtroFechaPromos}
      GROUP BY p.id, p.titulo, s.nombre_sucursal, n.nombre_negocio
      ORDER BY vistas DESC
      LIMIT 5
    `,
      [...(ciudadId ? [ciudadId] : []), ...paramsFecha],
    );

    // Sucursales más activas
    const sucursalesMasActivas = await this.connection.query(
      `
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
    `,
      ciudadId ? [ciudadId] : [],
    );

    // Métricas agrupadas por tipo de membresía
    // JLP-SEC: `negocios` no tiene columna `membresia_id` — nunca la tuvo.
    // Este JOIN tiraba ER_BAD_FIELD_ERROR (1054) desde siempre; era invisible
    // porque este endpoint exige AdminGuard y, hasta data_005, no existía
    // ningún admin en producción para llegar a probarlo.
    //
    // La membresía de un negocio NO se guarda en el negocio: se deriva del
    // suscriptor dueño, vía su suscripción activa (igual que en
    // suscripciones.service.ts / negocio.entity.ts). Existe también una tabla
    // `membresias_negocios` (negocio_id, membresia_id, activa) que parecía la
    // candidata obvia, pero se verificó contra producción que tiene 0 filas y
    // ningún código la escribe (sólo la leen, en dos sitios) — es una tabla
    // muerta, probablemente un intento de diseño abandonado. Usarla habría
    // dejado el reporte corriendo sin error pero vacío para siempre. Se
    // confirmó contra producción que el JOIN por suscripción sí trae datos
    // reales (17 negocios en Cortesía, 1 en Deluxe).
    const resumenPorMembresia = await this.connection.query(`
      SELECT
        m.id,
        m.nombre AS nombre_membresia,
        COUNT(DISTINCT n.id) AS total_negocios,
        COALESCE(SUM(e.vistas), 0) AS vistas,
        COALESCE(SUM(e.clics), 0) AS clics,
        COALESCE(SUM(e.busquedas), 0) AS busquedas
      FROM membresias m
      LEFT JOIN suscriptor_suscripciones ss ON ss.membresia_id = m.id AND ss.estatus = 'activa'
      LEFT JOIN negocios n ON n.suscriptor_id = ss.suscriptor_id AND n.eliminado = 0
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
   * Obtener KPIs ligeros (totales) de una sucursal específica.
   *
   * `likes` antes NO se incluía aquí (solo vistas/clics/busquedas), por lo
   * que el front (branch-detail) siempre mostraba 0 en esa tarjeta sin
   * importar los favoritos reales. Se agrega el mismo conteo de
   * `sucursal_likes` que ya usa getGlobalMetricsNegocio (favoritos reales de
   * suscriptores sobre la sucursal).
   */
  async getKpisSucursal(sucursalId: number) {
    const res = await this.connection.query(
      `SELECT
         COALESCE(es.vistas, 0) as vistas,
         COALESCE(es.clics, 0) as clics,
         COALESCE(es.busquedas, 0) as busquedas,
         COALESCE(lk.total_likes, 0) as likes
       FROM sucursales_negocios s
       LEFT JOIN estadisticas_sucursales es ON es.sucursal_id = s.id
       LEFT JOIN (
           SELECT sucursal_id, COUNT(id) AS total_likes
           FROM sucursal_likes
           GROUP BY sucursal_id
       ) lk ON lk.sucursal_id = s.id
       WHERE s.id = ?
       LIMIT 1`,
      [sucursalId],
    );

    // Si no hay registros aún, devolvemos ceros
    return res[0] || { vistas: 0, clics: 0, busquedas: 0, likes: 0 };
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
         COALESCE(vistas, 0)      AS vistas,
         COALESCE(clics, 0)       AS clics,
         COALESCE(busquedas, 0)   AS busquedas,
         COALESCE(llamadas, 0)    AS llamadas,
         COALESCE(whatsapp, 0)    AS whatsapp,
         COALESCE(direcciones, 0) AS direcciones
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
         COALESCE(es.llamadas, 0)                       AS llamadas,
         COALESCE(es.whatsapp, 0)                       AS whatsapp,
         COALESCE(es.direcciones, 0)                    AS direcciones,
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
        acc.totalVistas      += Number(s.vistas);
        acc.totalClics       += Number(s.clics);
        acc.totalBusquedas   += Number(s.busquedas);
        acc.totalLlamadas    += Number(s.llamadas);
        acc.totalWhatsapp    += Number(s.whatsapp);
        acc.totalDirecciones += Number(s.direcciones);
        acc.totalLikes       += Number(s.likes);
        acc.totalPromociones += Number(s.promocionesActivas);
        return acc;
      },
      {
        totalVistas: 0,
        totalClics: 0,
        totalBusquedas: 0,
        totalLlamadas: 0,
        totalWhatsapp: 0,
        totalDirecciones: 0,
        totalLikes: 0,
        totalPromociones: 0,
      },
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
      statsNegocio: statsNegocio[0] || {
        vistas: 0,
        clics: 0,
        busquedas: 0,
        llamadas: 0,
        whatsapp: 0,
        direcciones: 0,
      },
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
