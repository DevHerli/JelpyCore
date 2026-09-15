-- ============================================================
-- MIGRACIÓN: Tracking real de promociones (vistas/alcance/conversiones)
-- Proyecto: Jelpy Core
-- Ticket: METRICS-002
-- ============================================================
-- CAUSA QUE ESTA MIGRACIÓN RESUELVE
--   Las métricas "Vistas / Alcanzados / Conversiones" que se muestran en
--   branch-detail (app-branch-promotion-section) y en Promociones Globales
--   (global-promotions.page.ts) son 100% mock (`{vistas:0, alcanzados:0,
--   conversiones:0}` hardcodeado en el frontend). La tabla legacy
--   `estadisticas_promociones` sólo tiene `vistas`/`clics` (sin entidad
--   TypeORM, sólo SQL crudo), no soporta "alcanzados" (personas únicas) ni
--   "conversiones", y sólo se alimentaba desde 2 sitios del Home
--   (promotions.page.ts / category-page.component.ts) — nunca desde
--   branch-detail.
--
--   Tampoco existía forma de saber DÓNDE se descubrió una promoción (Home
--   vs. Chat) ni su categoría/subcategoría/especialidad al momento del
--   evento (la promoción no tiene esa relación directa: se hereda de
--   `promocion.sucursal.negocio.{categoria,subcategoria,especialidad}`, que
--   puede cambiar después — hay que "fotografiarla").
--
-- DISEÑO (mismo patrón que `search_trend_events`, ver
-- migrations/metrics_002_search_trend_events.sql)
--   Tabla de log por-evento (no agregada): cada vista/conversión es una fila.
--   - "Vistas" = COUNT(*) WHERE tipo_evento = 'vista'.
--   - "Alcanzados" (reach) = COUNT(DISTINCT COALESCE(usuario_id, device_id))
--     entre las filas de tipo 'vista' — NO es un tipo de evento aparte.
--   - "Conversiones" = COUNT(*) WHERE tipo_evento = 'conversion', con detalle
--     en `tipo_conversion` (llamada/whatsapp/como_llegar), reutilizando la
--     misma taxonomía que la conversión orgánica de negocios/sucursales
--     (ver metrics_001_conversion_organica.sql / EstadisticasService).
--   - `origen` distingue Home vs. Chat (Chat se implementará más adelante;
--     la columna ya queda lista para ese origen).
--   - `device_id` reutiliza el mismo concepto que `jelpy_ad_device_id` en el
--     frontend (ads.service.ts): UUID persistente por dispositivo, permite
--     medir alcance también de usuarios anónimos (no logueados).
-- ============================================================

CREATE TABLE IF NOT EXISTS promociones_eventos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  promocion_id BIGINT UNSIGNED NOT NULL,
  sucursal_id INT NOT NULL,
  negocio_id INT NOT NULL,

  tipo_evento ENUM('vista','conversion') NOT NULL,
  tipo_conversion ENUM('llamada','whatsapp','como_llegar') NULL,
  origen ENUM('home','chat') NOT NULL DEFAULT 'home',

  categoria_id INT NULL,
  subcategoria_id INT NULL,
  especialidad_id INT NULL,
  categoria_nombre VARCHAR(160) NULL,
  subcategoria_nombre VARCHAR(160) NULL,
  especialidad_nombre VARCHAR(160) NULL,

  usuario_id INT NULL,
  device_id VARCHAR(80) NULL,

  fecha DATE NOT NULL,
  hora TINYINT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,

  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_promo_eventos_promocion (promocion_id, tipo_evento),
  KEY idx_promo_eventos_sucursal (sucursal_id, tipo_evento, fecha),
  KEY idx_promo_eventos_negocio (negocio_id, tipo_evento, fecha),
  KEY idx_promo_eventos_categoria (categoria_id, fecha),
  KEY idx_promo_eventos_subcategoria (subcategoria_id, fecha),
  KEY idx_promo_eventos_especialidad (especialidad_id, fecha),
  KEY idx_promo_eventos_origen (origen, fecha),
  KEY idx_promo_eventos_fecha (fecha),
  CONSTRAINT fk_promo_eventos_promocion
    FOREIGN KEY (promocion_id) REFERENCES promociones_sucursales(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Verificación post-migración ────────────────────────────────────────────
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'promociones_eventos'
ORDER BY ORDINAL_POSITION;
