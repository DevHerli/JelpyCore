-- METRICS-003 — Log detallado de eventos por origen/superficie.
--
-- Mantiene los contadores agregados existentes en estadisticas_negocios /
-- estadisticas_sucursales, pero agrega una tabla append-only para poder
-- responder preguntas como: "cuántas búsquedas llegaron desde chat vs search".

CREATE TABLE IF NOT EXISTS estadisticas_eventos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  tipo VARCHAR(40) NOT NULL,
  entidad ENUM('negocio', 'sucursal') NOT NULL,
  entidad_id INT NULL,

  origen VARCHAR(40) NOT NULL DEFAULT 'unknown',
  superficie VARCHAR(80) NULL,
  termino VARCHAR(255) NULL,

  ciudad_id INT NULL,
  ciudad_nombre VARCHAR(120) NULL,

  categoria_id INT NULL,
  categoria_nombre VARCHAR(160) NULL,
  subcategoria_id INT NULL,
  subcategoria_nombre VARCHAR(160) NULL,

  negocio_id INT NULL,
  sucursal_id INT NULL,

  resultados INT NOT NULL DEFAULT 0,
  sin_resultados TINYINT(1) NOT NULL DEFAULT 0,
  metadata LONGTEXT NULL,

  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_est_eventos_sucursal_tipo_origen (sucursal_id, tipo, origen),
  INDEX idx_est_eventos_sucursal_sin_resultados (sucursal_id, sin_resultados, tipo),
  INDEX idx_est_eventos_categoria (sucursal_id, categoria_id),
  INDEX idx_est_eventos_ciudad (sucursal_id, ciudad_id),
  INDEX idx_est_eventos_negocio (negocio_id, tipo, origen),
  INDEX idx_est_eventos_creado_en (creado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
