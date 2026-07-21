-- ============================================================
-- Vista: vista_negocios_completa
-- Compatible con MariaDB / MySQL 5.7+  (sin LATERAL)
-- Ejecutar en la DB de QA:
--   DROP VIEW IF EXISTS vista_negocios_completa;
--   (luego pegar el CREATE OR REPLACE de abajo)
-- ============================================================

CREATE OR REPLACE VIEW vista_negocios_completa AS
SELECT
  n.id                                         AS negocio_id,
  n.nombre_negocio,
  n.descripcion                                AS descripcion_negocio,

  s.ciudad_id,
  ciu.nombre                                   AS ciudad,

  cat.nombre                                   AS categoria,
  cat.id                                       AS categoria_id,
  sub.nombre                                   AS subcategoria,
  sub.id                                       AS subcategoria_id,
  esp.nombre                                   AS especialidad,
  esp.id                                       AS especialidad_id,

  s.id                                         AS sucursal_id,
  s.nombre_sucursal,
  s.latitud,
  s.longitud,

  /* Horarios concatenados: "Lunes 08:00:00 18:00:00 0 | Martes ..." */
  (
    SELECT GROUP_CONCAT(
      CONCAT(h.dia_semana, ' ', h.hora_apertura, ' ', h.hora_cierre, ' ', h.cerrado)
      ORDER BY FIELD(h.dia_semana,
        'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo')
      SEPARATOR ' | '
    )
    FROM horarios_sucursal h
    WHERE h.sucursal_id = s.id AND h.eliminado = 0
  )                                            AS horarios_keywords,

  /* Promo activa más reciente — sin LATERAL (compatible MariaDB) */
  pr.titulo                                    AS promo_titulo,
  pr.descripcion                               AS promo_descripcion,
  pr.tipo_promocion,
  pr.valor_descuento,
  pr.fecha_inicio                              AS promo_fecha_inicio,
  pr.fecha_fin                                 AS promo_fecha_fin,
  pr.hora_inicio                               AS promo_hora_inicio,
  pr.hora_fin                                  AS promo_hora_fin,
  pr.dias_vigencia                             AS promo_dias_vigencia,
  pr.activa                                    AS promo_activa,
  pr.imagen_url                                AS promo_imagen_url,
  pr.origen                                    AS promo_origen,

  /* Catálogo interno del negocio */
  (
    SELECT GROUP_CONCAT(DISTINCT cc.nombre SEPARATOR ' ')
    FROM categorias_catalogo cc
    WHERE cc.negocio_id = n.id
  )                                            AS catalogo_keywords,

  /* Anuncios activos de la sucursal */
  (
    SELECT GROUP_CONCAT(DISTINCT a.titulo SEPARATOR ' ')
    FROM anuncios a
    WHERE a.sucursal_id = s.id AND a.eliminado = 0
  )                                            AS anuncio_keywords,

  /* Características de la sucursal */
  (
    SELECT GROUP_CONCAT(DISTINCT cf.nombre SEPARATOR ' ')
    FROM sucursales_caracteristicas sc
    INNER JOIN caracteristicas_sucursal cf ON cf.id = sc.caracteristica_id
    WHERE sc.sucursal_id = s.id
  )                                            AS caracteristicas_keywords,

  /* Items / productos del negocio */
  (
    SELECT GROUP_CONCAT(DISTINCT i.nombre SEPARATOR ' ')
    FROM items_negocio i
    WHERE i.negocio_id = n.id
  )                                            AS items_keywords

FROM negocios n

/* Solo sucursales activas (no eliminadas) */
LEFT JOIN sucursales_negocios s
       ON s.negocio_id = n.id AND s.eliminado = 0

LEFT JOIN ciudades ciu  ON ciu.id = s.ciudad_id
LEFT JOIN categorias cat ON cat.id = n.categoria_id
LEFT JOIN subcategorias sub ON sub.id = n.subcategoria_id
LEFT JOIN especialidades esp ON esp.id = n.especialidad_id

/* Promo: subquery correlacionada en lugar de LATERAL */
LEFT JOIN promociones_sucursales pr
       ON pr.id = (
           SELECT id
           FROM promociones_sucursales
           WHERE sucursal_id = s.id
             AND eliminado  = 0
             AND activa     = 1
           ORDER BY fecha_registro DESC
           LIMIT 1
       )

/* Solo negocios activos (no eliminados) */
WHERE n.eliminado = 0;
