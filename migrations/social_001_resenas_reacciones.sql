-- ============================================================
-- MIGRACIÓN: Reacciones (like / dislike) en reseñas de sucursal
-- Proyecto: Jelpy Core
-- Ticket: SOCIAL-001
-- Descripción: Crea la tabla que respalda a SucursalReviewReaccion
--              (entity) para que los usuarios puedan dar "manita
--              arriba / manita abajo" a cada reseña.
-- ============================================================
-- CAUSA QUE ESTA MIGRACIÓN RESUELVE
--   Se agregó la entity SucursalReviewReaccion, pero `synchronize`
--   está apagado en PROD (app.module.ts: DB_SYNC). Sin este DDL,
--   POST /sucursales-reviews/:id/reaccion consultaría una tabla
--   inexistente → ER_NO_SUCH_TABLE (1146) → 500.
--
-- El DDL replica exactamente
--   src/modules/business/sucursales_reviews/entities/sucursal-review-reaccion.entity.ts
-- Si esa entity cambia, esta migración tiene que cambiar con ella.
--
-- Idempotente: usa IF NOT EXISTS. Sintaxis MySQL 8 / MariaDB.

-- ── Tabla de reacciones ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sucursales_resenas_reacciones (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Reseña reaccionada. Si la reseña se borra, sus reacciones se van con ella.
  resena_id      BIGINT UNSIGNED NOT NULL,
  -- Autor de la reacción. Si el suscriptor se borra, su reacción desaparece.
  suscriptor_id  BIGINT UNSIGNED NOT NULL,

  tipo           ENUM('like','dislike') NOT NULL,

  fecha_creacion      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- Un suscriptor solo puede tener UNA reacción por reseña. Mismo nombre que el
  -- @Unique de la entity para que un DB_SYNC=true en QA no intente recrearlo.
  UNIQUE KEY uq_resena_suscriptor (resena_id, suscriptor_id),
  INDEX idx_reaccion_resena (resena_id),

  CONSTRAINT fk_reaccion_resena
    FOREIGN KEY (resena_id)     REFERENCES sucursales_resenas(id) ON DELETE CASCADE,
  CONSTRAINT fk_reaccion_suscriptor
    FOREIGN KEY (suscriptor_id) REFERENCES suscriptores(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Reacciones (like/dislike) de suscriptores a reseñas de sucursal';

-- ── Verificación post-migración ────────────────────────────────────────────
-- Esperado: 1 tabla con 2 foreign keys y la unique compuesta.
SELECT
  'sucursales_resenas_reacciones' AS objeto,
  COUNT(*)                        AS columnas
FROM information_schema.COLUMNS
WHERE TABLE_NAME   = 'sucursales_resenas_reacciones'
  AND TABLE_SCHEMA = DATABASE()

UNION ALL

SELECT
  'reacciones.foreign_keys' AS objeto,
  COUNT(*)                  AS columnas
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_NAME      = 'sucursales_resenas_reacciones'
  AND TABLE_SCHEMA    = DATABASE()
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';
