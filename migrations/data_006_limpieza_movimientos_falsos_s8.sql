-- ============================================================================
-- MIGRACIÓN: data_006 — limpieza de 2 movimientos falsos en el estado de
--   cuenta del suscriptor 8
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- EL PROBLEMA
--   estado_cuenta_movimientos tenía 2 filas para el suscriptor 8 que no
--   correspondían a ningún cobro real:
--
--     id=1  cargo  'Cargo membresía Deluxe'   $599.00  ref: suscriptor_suscripciones(1)
--     id=2  abono  'Pago recibido Stripe'     $599.00  ref: pagos(10)
--
--   Se verificó contra producción, cruzando cada referencia:
--     · suscriptor_suscripciones id=1 es la suscripción de Cortesía del
--       propio suscriptor 8 (membresia_id=2, precio $0.00) — no es Deluxe.
--     · pagos id=10 NO EXISTE. El único pago real del suscriptor 8 es
--       pagos.id=1: negocio_id=6 ("Hospital Puerta de Hierro", eliminado=1,
--       de baja), membresia_id=2 (Cortesía), monto $599.00, metodo='stripe',
--       estatus='pendiente' — nunca se completó.
--     · suscriptores.stripe_customer_id del 8 es NULL: nunca hubo un cliente
--       de Stripe real detrás de este cargo.
--     · $599 no coincide con ningún precio vigente hoy; sí coincide con el
--       precio ANTERIOR de Premium (billing_005 lo bajó de $599/12 meses a
--       $399/1 mes esta misma sesión). El movimiento es de 2026-03-05, previo
--       a ese cambio.
--
--   Conclusión: son datos de prueba de una corrida vieja del flujo de
--   checkout, insertados directamente en el libro contable (mismo patrón que
--   las 3 suscripciones duplicadas de data_003: alta manual, no generada por
--   el backend). No reflejan ningún cargo o abono real.
--
-- POR QUÉ IMPORTA
--   El suscriptor 8 es ahora la cuenta admin (data_005) y la que se usa para
--   dar de alta negocios de cortesía. Dejar un cargo/abono ficticio de $599
--   en su estado de cuenta contamina cualquier reporte financiero o
--   conciliación que se corra sobre esa cuenta más adelante.
--
-- SEGURIDAD
--   Backup previo de las 2 filas exactas en
--   .local/backups/estado_cuenta_movimientos-s8-PROD-*.sql (INSERTs listos
--   para restaurar, gitignored). DELETE acotado por id IN (1,2) AND
--   suscriptor_id=8 dentro de una transacción, con verificación de fila
--   exacta antes de borrar y de affectedRows=2 antes de COMMIT.
--
--   Aplicado y verificado: affected=2, 0 movimientos restantes del
--   suscriptor 8.
-- ============================================================================


-- ── Verificación previa (no modifica nada) ─────────────────────────────────
SELECT * FROM estado_cuenta_movimientos WHERE id IN (1, 2) AND suscriptor_id = 8;


-- ── El borrado ──────────────────────────────────────────────────────────
DELETE FROM estado_cuenta_movimientos WHERE id IN (1, 2) AND suscriptor_id = 8;
--   Esperado: 2 filas afectadas.


-- ── Verificación posterior ──────────────────────────────────────────────
SELECT COUNT(*) AS movimientos_restantes_suscriptor_8
  FROM estado_cuenta_movimientos WHERE suscriptor_id = 8;
--   Esperado: 0.


-- ── Rollback manual (restaurar desde el backup) ────────────────────────
--   Ejecutar el contenido de
--   .local/backups/estado_cuenta_movimientos-s8-PROD-<timestamp>.sql
--   (son 2 INSERT con los valores originales exactos).
-- ============================================================================
