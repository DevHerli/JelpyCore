-- ============================================================================
-- MIGRACIÓN: data_003 — una sola suscripción activa por suscriptor
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- QUÉ PASA HOY
--   El suscriptor 1 tiene TRES suscripciones Premium simultáneas en estado
--   'activa':
--
--     id | suscriptor | membresia | estatus | fecha_creacion
--      2 |     1      | 4 Premium | activa  | 2026-07-31 07:44:15
--      3 |     1      | 4 Premium | activa  | 2026-07-31 08:31:09
--      4 |     1      | 4 Premium | activa  | 2026-07-31 08:32:39
--
--   Las tres tienen exactamente el mismo periodo (2026-07-31 → 2026-08-31),
--   `proveedor_pago = 'stripe'` y `proveedor_suscripcion_id = NULL`.
--
-- DE DÓNDE SALIERON
--   No las creó el backend. Se descartaron los tres caminos posibles:
--     · crearSuscripcion()        rechaza si ya hay una activa
--     · renovarOCrearSuscripcion() extiende la existente en vez de crear otra
--     · cambiarPlan()             cancela la anterior dentro de la transacción
--   Además `billing_subscriptions` y `stripe_processed_events` están VACÍAS:
--   ningún webhook de Stripe se ha procesado nunca en esta base. Y el
--   `proveedor_suscripcion_id` está en NULL, cosa que el webhook siempre llena.
--   Conclusión: son inserciones manuales de la sesión de configuración del
--   31/07 (las filas 4 y 5 comparten el segundo exacto de creación).
--
-- CUÁL SE CONSERVA Y POR QUÉ
--   Se conserva la id=4:
--     a) es la que el backend ya está usando — obtenerSuscripcionActiva(),
--        setAutoRenew() y consumirCuota() ordenan por `id DESC`;
--     b) es la única con un ciclo abierto en `suscripcion_ciclos`
--        (ciclo id=84, agosto 2026). Las ids 2 y 3 no tienen ninguno.
--   Las ids 2 y 3 no tienen NINGUNA fila hija: la única FK que apunta a esta
--   tabla es suscripcion_ciclos.suscripcion_id, y ahí no aparecen.
--
--   No se BORRAN: se marcan 'cancelada' con fecha_fin de hoy. Borrar sería
--   irreversible y perdería la evidencia de que existieron; cancelarlas
--   resuelve el problema funcional (queda una sola activa) y deja rastro.
--
-- POR QUÉ IMPORTA ANTES DE SALIR A PRODUCCIÓN
--   Con tres filas 'activa' el sistema es ambiguo: cada consulta que use
--   findOne(estatus:'activa') puede devolver una distinta según el ORDER BY,
--   y `consumirCuota` bloquea y descuenta cupos sobre una fila mientras el
--   dashboard puede estar leyendo otra. Los cupos consumidos se pierden.
--
-- LA GUARDA QUE EVITA QUE VUELVA A PASAR
--   La sección 3 agrega un índice UNIQUE que hace imposible tener dos filas
--   'activa' del mismo suscriptor, venga de donde venga la escritura
--   (backend, phpMyAdmin o un script). MariaDB no tiene índices parciales, así
--   que se usa una columna generada que vale `suscriptor_id` sólo cuando el
--   estatus es 'activa' y NULL en cualquier otro caso; en un índice UNIQUE los
--   NULL no colisionan entre sí, de modo que un suscriptor puede acumular
--   todas las canceladas/expiradas que quiera.
--
--   Se limita a 'activa' a propósito. Cubrir también 'en_mora' o 'prueba'
--   parecía más estricto, pero rompería el flujo de recuperación de un pago
--   fallido: el suscriptor se queda en 'en_mora' y el webhook necesita poder
--   abrir la nueva suscripción antes de cerrar la vieja.
--
-- SEGURIDAD
--   Transaccional para los datos. Idempotente. Sin DROP de tablas.
--   El ALTER de la sección 3 es DDL y hace commit implícito: por eso va
--   DESPUÉS del commit de datos, nunca dentro de la transacción.
-- ============================================================================


-- ── 0. ANTES DE EJECUTAR (no modifica nada) ────────────────────────────────

SELECT DATABASE() AS base_actual;
--     Debe decir: jelpymx_core_assistant

-- Foto de las suscripciones activas duplicadas. Debe listar 1 → 3 filas.
SELECT suscriptor_id, COUNT(*) AS activas, GROUP_CONCAT(id ORDER BY id) AS ids
  FROM suscriptor_suscripciones
 WHERE estatus = 'activa'
 GROUP BY suscriptor_id
HAVING COUNT(*) > 1;

-- Confirmar que 2 y 3 no tienen ciclos (debe dar 0) y que 4 sí (debe dar >= 1).
SELECT suscripcion_id, COUNT(*) AS ciclos
  FROM suscripcion_ciclos
 WHERE suscripcion_id IN (2, 3, 4)
 GROUP BY suscripcion_id;


-- ── 1. LIMPIEZA DE DUPLICADOS ──────────────────────────────────────────────

START TRANSACTION;

-- Cancela toda suscripción 'activa' que NO sea la de id más alto de su
-- suscriptor. Escrito de forma general (no con "WHERE id IN (2,3)") para que
-- sirva aunque aparezca otro duplicado antes de ejecutarlo.
UPDATE suscriptor_suscripciones s
  JOIN (
        SELECT suscriptor_id, MAX(id) AS conservar
          FROM suscriptor_suscripciones
         WHERE estatus = 'activa'
         GROUP BY suscriptor_id
       ) ultima
    ON ultima.suscriptor_id = s.suscriptor_id
   SET s.estatus             = 'cancelada',
       s.fecha_fin           = CURDATE(),
       s.fecha_actualizacion = NOW()
 WHERE s.estatus = 'activa'
   AND s.id <> ultima.conservar;
--   Esperado: 2 filas afectadas (ids 2 y 3).

COMMIT;


-- ── 2. VERIFICACIÓN DE DATOS (no modifica nada) ────────────────────────────

-- 2.a Ya no debe quedar ningún suscriptor con más de una activa. 0 filas.
SELECT suscriptor_id, COUNT(*) AS activas
  FROM suscriptor_suscripciones
 WHERE estatus = 'activa'
 GROUP BY suscriptor_id
HAVING COUNT(*) > 1;

-- 2.b Estado final de las cinco suscripciones.
SELECT id, suscriptor_id, membresia_id, estatus, fecha_inicio, fecha_fin
  FROM suscriptor_suscripciones
 ORDER BY id;
--   Esperado: 1 activa | 2 cancelada | 3 cancelada | 4 activa | 5 activa

-- 2.c El ciclo 84 debe seguir colgando de la suscripción 4, intacto.
SELECT id, suscripcion_id, ciclo_inicio, ciclo_fin
  FROM suscripcion_ciclos
 WHERE suscripcion_id = 4;


-- ── 3. GUARDA PERMANENTE (DDL — commit implícito) ──────────────────────────
-- Ejecutar sólo si la sección 2.a devolvió 0 filas.

ALTER TABLE suscriptor_suscripciones
  ADD COLUMN suscriptor_activa_uniq BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN estatus = 'activa' THEN suscriptor_id END) PERSISTENT
    COMMENT 'Columna técnica para el UNIQUE uq_ss_una_activa. No la mapea ninguna entity.';

ALTER TABLE suscriptor_suscripciones
  ADD UNIQUE KEY uq_ss_una_activa (suscriptor_activa_uniq);


-- ── 4. VERIFICACIÓN DE LA GUARDA (no modifica nada) ────────────────────────

-- 4.a El índice debe existir y ser único (Non_unique = 0).
SHOW INDEX FROM suscriptor_suscripciones WHERE Key_name = 'uq_ss_una_activa';

-- 4.b Prueba real de que la guarda funciona. Se hace dentro de una transacción
--     que SIEMPRE se revierte, así que no deja nada en la base.
START TRANSACTION;
INSERT INTO suscriptor_suscripciones
       (suscriptor_id, membresia_id, estatus, fecha_inicio, renovacion_automatica)
VALUES (1, 4, 'activa', CURDATE(), 0);
--   Esperado: ERROR 1062 Duplicate entry '1' for key 'uq_ss_una_activa'
ROLLBACK;


-- ── 5. ROLLBACK MANUAL (sólo si hay que revertir) ──────────────────────────
--
--   ALTER TABLE suscriptor_suscripciones DROP INDEX uq_ss_una_activa;
--   ALTER TABLE suscriptor_suscripciones DROP COLUMN suscriptor_activa_uniq;
--
--   UPDATE suscriptor_suscripciones
--      SET estatus = 'activa', fecha_fin = '2026-08-31', fecha_actualizacion = NOW()
--    WHERE id IN (2, 3);
--
--   Los ids van escritos a mano y no como subconsulta: revertir "todo lo que
--   se canceló hoy" arrastraría cancelaciones legítimas de usuarios reales.
-- ============================================================================
