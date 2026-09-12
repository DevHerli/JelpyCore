-- ============================================================
-- MIGRACIÓN: Tracking de conversión orgánica (llamadas/whatsapp/direcciones)
-- Proyecto: Jelpy Core
-- Ticket: METRICS-001
-- ============================================================
-- CAUSA QUE ESTA MIGRACIÓN RESUELVE
--   Hoy, cuando un usuario llega a la ficha de un negocio por búsqueda,
--   categoría o el chat de Jelpy (es decir, SIN venir de un anuncio) y toca
--   "Llamar" / "WhatsApp" / "Cómo llegar", no queda absolutamente ningún
--   registro en el sistema: `business-details.modal.ts` solo reporta esas
--   acciones como `conversion` al módulo de ads, y ese módulo exige que haya
--   existido un `click` de campaña previo (AdAttributionService) — si no lo
--   hay, es un no-op total.
--
--   Esta migración agrega las columnas necesarias para contar estas 3
--   acciones también en el sistema de estadísticas orgánicas ya existente
--   (`estadisticas_negocios` / `estadisticas_sucursales`, consumido por
--   `EstadisticasService.getGlobalMetricsNegocio` → tab "Métricas" del
--   negocio), igual que ya se hace con `vistas` / `clics` / `busquedas`.
--
--   v1 simple: solo totales por tipo de acción (llamadas/whatsapp/
--   direcciones), sin desglose de origen (ads vs orgánico) — el cruce con
--   ads queda para una v2, a pedido de negocio.
--
-- SEGUNDO PROBLEMA QUE APROVECHA A CORREGIR ESTA MIGRACIÓN
--   `EstadisticasService.registrarEvento()` hace SELECT (¿existe la fila?)
--   seguido de UPDATE o INSERT — no es atómico. Bajo carga concurrente (dos
--   requests casi simultáneos para el mismo negocio/sucursal) ambos pueden
--   ver "no existe" y ambos intentar INSERT, o perder un incremento. Se
--   agrega UNIQUE KEY sobre negocio_id / sucursal_id para permitir migrar el
--   código a `INSERT ... ON DUPLICATE KEY UPDATE` (atómico).
--
--   Verificado contra producción antes de escribir esta migración:
--   0 negocio_id duplicados en estadisticas_negocios (18 filas) y
--   0 sucursal_id duplicados en estadisticas_sucursales (19 filas) — seguro
--   agregar el UNIQUE KEY sin conflictos.
-- ============================================================

-- ── 1. Nuevas columnas de conversión orgánica ──────────────────────────────
ALTER TABLE estadisticas_negocios
  ADD COLUMN llamadas    INT NOT NULL DEFAULT 0 AFTER busquedas,
  ADD COLUMN whatsapp    INT NOT NULL DEFAULT 0 AFTER llamadas,
  ADD COLUMN direcciones INT NOT NULL DEFAULT 0 AFTER whatsapp;

ALTER TABLE estadisticas_sucursales
  ADD COLUMN llamadas    INT NOT NULL DEFAULT 0 AFTER busquedas,
  ADD COLUMN whatsapp    INT NOT NULL DEFAULT 0 AFTER llamadas,
  ADD COLUMN direcciones INT NOT NULL DEFAULT 0 AFTER whatsapp;

-- ── 2. UNIQUE KEY para permitir upsert atómico ─────────────────────────────
ALTER TABLE estadisticas_negocios
  ADD UNIQUE KEY uq_estadisticas_negocios_negocio_id (negocio_id);

ALTER TABLE estadisticas_sucursales
  ADD UNIQUE KEY uq_estadisticas_sucursales_sucursal_id (sucursal_id);

-- ── Verificación post-migración ────────────────────────────────────────────
-- Esperado: 6 columnas nuevas visibles (3 por tabla) y un UNIQUE KEY por tabla.
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('estadisticas_negocios', 'estadisticas_sucursales')
  AND COLUMN_NAME IN ('llamadas', 'whatsapp', 'direcciones')
ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('estadisticas_negocios', 'estadisticas_sucursales')
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;
