-- ============================================================================
-- MIGRACIÓN: billing_004 — corrige dos fallos que impiden cobrar
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- Ejecutar DESPUÉS de billing_003. Idempotente. Sin sentencias DROP.
--
-- ============================================================================
-- FALLO 1 (BLOQUEANTE): falta suscriptores.stripe_customer_id
-- ============================================================================
--   La entity Suscriptor declara:
--     @Column({ name: 'stripe_customer_id', ... }) stripeCustomerId?: string;
--   pero la columna no existe en la tabla. billing_003 no la creaba: la añadía
--   a billing_subscriptions, que es una tabla distinta.
--
--   Impacto: createCheckoutSession() ejecuta
--     suscriptorRepo.findOne({ where: { id } })
--   que pide TODAS las columnas de la entity. Al faltar ésta, revienta con
--   ER_BAD_FIELD_ERROR (1054) y el checkout falla SIEMPRE, antes siquiera de
--   llamar a Stripe. Verificado reproduciendo el SELECT:
--     SELECT id, stripe_customer_id FROM suscriptores LIMIT 1;
--     -> 1054 Unknown column 'stripe_customer_id' in 'SELECT'
--
--   Nota: el login no se veía afectado porque JwtAuthGuard selecciona
--   explícitamente sólo (id, role), esquivando la columna ausente.

ALTER TABLE suscriptores
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100) NULL
    COMMENT 'Stripe Customer (cus_xxx). Se rellena en el primer checkout.';

-- Búsqueda por customer en webhooks:
ALTER TABLE suscriptores
  ADD INDEX IF NOT EXISTS idx_suscriptores_stripe_customer (stripe_customer_id);


-- ============================================================================
-- FALLO 2: el plan se llama "Deluxe", no "Delux"
-- ============================================================================
--   billing_003 hacía  WHERE nombre = 'Delux'  y en producción el plan es
--   'Deluxe'. Ese UPDATE afectó 0 filas y el plan quedó SIN price de Stripe:
--   al intentar pagarlo devuelve 400 "no tiene un Price de Stripe configurado".
--
--   Se usa un WHERE tolerante para que aplique con o sin la "e" final.

UPDATE membresias
   SET stripe_price_id = 'price_1U6LDoEQi85l8GK22f4tZqdG'
 WHERE nombre IN ('Delux', 'Deluxe')
   AND stripe_price_id IS NULL;

-- Debe reportar 1 row affected. Si dice 0, verificar el nombre exacto con:
--   SELECT id, CONCAT('[', nombre, ']') FROM membresias;


-- ============================================================================
-- VERIFICACIÓN (no modifica nada)
-- ============================================================================

-- 1. La columna bloqueante debe existir:
SELECT IF(COUNT(*) > 0, 'OK - checkout desbloqueado', '*** SIGUE FALTANDO ***')
         AS suscriptores_stripe_customer_id
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'suscriptores'
   AND COLUMN_NAME  = 'stripe_customer_id';

-- 2. Estado de los planes. Los 3 de pago deben tener price_id:
SELECT id, nombre, precio, duracion_meses,
       IFNULL(stripe_price_id, '(sin price)') AS stripe_price_id
  FROM membresias
 ORDER BY id;


-- ============================================================================
-- ADVERTENCIA — NO RESUELTA AQUÍ, REQUIERE DECISIÓN DE NEGOCIO
-- ============================================================================
--   Los precios de la BD NO coinciden con los Prices creados en Stripe:
--
--     Plan          BD (producción)        Stripe (price_id asignado)
--     ----------------------------------------------------------------
--     Deluxe        $300 / 6 meses         $199 / MES
--     Premium       $599 / 12 meses        $399 / MES
--     Empresarial   $1299 / 12 meses       $699 / MES
--
--   Stripe cobra SIEMPRE lo que dice el Price, no lo que diga esta tabla.
--   Un usuario que contrate "Premium $599 por 12 meses" quedaría suscrito a
--   $399 MENSUALES = $4,788 al año. Casi 8x lo que se le mostró.
--
--   En modo test no hay dinero real de por medio, pero con claves live esto
--   son cargos indebidos, contracargos y un problema legal.
--
--   Hay que alinear ambos lados ANTES de pasar a live. Dos opciones:
--     a) Crear en Stripe Prices que reflejen la realidad del negocio
--        (ej. Premium: $599 con interval=year), y sustituir los price_id.
--     b) Ajustar precio y duracion_meses en la BD para que coincidan con los
--        Prices actuales de Stripe.
--
--   Mientras no se resuelva, no habilitar claves live.
-- ============================================================================
