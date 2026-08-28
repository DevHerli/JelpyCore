-- ============================================================
-- MIGRACIÓN: Permitir múltiples reseñas por suscriptor (Opción B)
-- Proyecto: Jelpy Core
-- Ticket: SOCIAL-002
-- Descripción: Elimina el índice UNIQUE heredado sobre
--              sucursales_resenas (suscriptor_id, sucursal_id) que
--              impedía que un mismo suscriptor dejara más de una
--              reseña en la misma sucursal.
-- ============================================================
-- CAUSA QUE ESTA MIGRACIÓN RESUELVE
--   La regla "1 reseña por sucursal" se retiró del servicio
--   (sucursal-review.service.ts → create(): Opción B). Pero la
--   tabla `sucursales_resenas` conservaba el índice UNIQUE
--   `uq_resena_suscriptor_sucursal` (suscriptor_id, sucursal_id)
--   de cuando esa regla se aplicaba a nivel de base de datos. Sin
--   la validación en código, el segundo INSERT del mismo autor
--   golpea ese índice → ER_DUP_ENTRY (1062) → 500.
--
--   La entity SucursalReview NO declara @Unique, así que este
--   índice es un remanente (creado por un `synchronize:true` en
--   dev o manualmente). Quitarlo alinea la base con la entity.
--
-- Nombre del índice confirmado en producción vía information_schema:
--   uq_resena_suscriptor_sucursal  (suscriptor_id, sucursal_id)
--
-- Nota: MySQL/MariaDB no soportan "DROP INDEX IF EXISTS" en tablas.
-- Si el índice ya se eliminó, esta sentencia dará error 1091 y se
-- puede ignorar sin problema.

ALTER TABLE sucursales_resenas DROP INDEX uq_resena_suscriptor_sucursal;

-- ── Verificación post-migración ────────────────────────────────────────────
-- Esperado: la única fila con NON_UNIQUE = 0 debe ser PRIMARY.
SELECT INDEX_NAME,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas,
       NON_UNIQUE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME   = 'sucursales_resenas'
GROUP BY INDEX_NAME, NON_UNIQUE;
