-- ============================================================================
-- MIGRACIÓN: billing_005 — alinea los precios de la BD con los de Stripe
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- QUÉ HACE
--   Deja los 3 planes de pago como suscripción MENSUAL SIN PLAZO FORZOSO,
--   con el mismo precio que ya está configurado en Stripe:
--
--     Plan          ANTES (BD)          DESPUÉS (= Stripe)
--     ---------------------------------------------------------
--     Deluxe        $300 / 6 meses      $199 / 1 mes
--     Premium       $599 / 12 meses     $399 / 1 mes
--     Empresarial   $1299 / 12 meses    $699 / 1 mes
--
--   No toca Gratuita, Cortesia ni Plan Especial.
--
-- POR QUÉ IMPORTA
--   Stripe cobra SIEMPRE lo que dice el Price, no lo que diga esta tabla.
--   Con los valores actuales, quien contratara "Premium $599 por 12 meses"
--   quedaría suscrito a $399 MENSUALES = $4,788 al año: 8x lo que se le
--   mostró. En test no hay dinero real; en live son cargos indebidos.
--
-- SOBRE duracion_meses = 1  (esto NO es un plazo forzoso)
--   La columna no significa "el cliente se compromete N meses". Define cuánto
--   dura UN ciclo de cobro. El código la usa para calcular el vencimiento:
--
--     src/modules/suscripciones/suscripciones.service.ts:196-199
--       const duracionMeses = Number(membresia.duracion_meses) || 1;
--       fechaFin.setMonth(fechaFin.getMonth() + duracionMeses);
--
--   Con 12, la app le da al usuario 12 meses de acceso mientras Stripe cobra
--   mes a mes: si la tarjeta falla en el mes 2, el sistema lo sigue viendo
--   vigente 10 meses más. Con 1, cada ciclo dura un mes, se renueva solo y se
--   cancela cuando el usuario quiera. Es justo lo contrario del plazo forzoso:
--   los valores 6 y 12 actuales son los que se comportan como permanencia.
--
-- SEGURIDAD
--   Idempotente (correrlo dos veces deja el mismo resultado). Sin DROP.
--   Transaccional: si algo falla, ROLLBACK y no queda a medias.
--   Incluye rollback manual con los valores exactos anteriores.
-- ============================================================================


-- ── 0. ANTES DE EJECUTAR (no modifica nada) ────────────────────────────────

-- 0.a Confirmar que estás en la base correcta:
SELECT DATABASE() AS base_actual;
--     Debe decir: jelpymx_core_assistant
--     Si dice qajelpym_databaseCore, DETENTE: esa es QA.

-- 0.b GUARDAR el estado actual. Copia el resultado a un archivo antes de
--     seguir: es tu respaldo si hay que revertir.
SELECT id, nombre, precio, duracion_meses, stripe_price_id
  FROM membresias
 ORDER BY id;

-- 0.c ¿Hay alguien ya suscrito a estos planes? Si devuelve filas, esos
--     usuarios verán cambiar su precio y su ciclo de renovación. Revisarlo
--     ANTES de continuar (en QA daba 0 filas; producción puede diferir).
SELECT m.nombre AS plan, s.estatus, COUNT(*) AS usuarios
  FROM suscriptor_suscripciones s
  JOIN membresias m ON m.id = s.membresia_id
 WHERE m.nombre IN ('Delux', 'Deluxe', 'Premium', 'Empresarial')
 GROUP BY m.nombre, s.estatus;

-- 0.d Suscripciones de Stripe ya en marcha (mismo criterio):
SELECT plan_estatus, COUNT(*) AS n
  FROM billing_subscriptions
 GROUP BY plan_estatus;


-- ── 1. ACTUALIZACIÓN ───────────────────────────────────────────────────────
-- Se ejecuta dentro de una transacción: o entran los 3 planes, o ninguno.

START TRANSACTION;

-- Deluxe → $199 / mes
-- WHERE tolerante: en producción el plan se llama 'Deluxe' (con e final),
-- por eso un UPDATE previo con 'Delux' afectó 0 filas y lo dejó sin price.
UPDATE membresias
   SET precio          = 199.00,
       duracion_meses  = 1,
       stripe_price_id = 'price_1U6LDoEQi85l8GK22f4tZqdG'
 WHERE nombre IN ('Delux', 'Deluxe');

-- Premium → $399 / mes
UPDATE membresias
   SET precio          = 399.00,
       duracion_meses  = 1,
       stripe_price_id = 'price_1U6LDqEQi85l8GK2wiR5WyFj'
 WHERE nombre = 'Premium';

-- Empresarial → $699 / mes
UPDATE membresias
   SET precio          = 699.00,
       duracion_meses  = 1,
       stripe_price_id = 'price_1U6LDtEQi85l8GK2gRE3oRvQ'
 WHERE nombre = 'Empresarial';

-- Cada UPDATE debe reportar 1 row affected (o "0 changed" si ya estaba bien:
-- eso es correcto, significa que ya se había aplicado).
--
-- Si alguno afecta 0 FILAS (no "0 changed"), el plan tiene otro nombre:
-- ejecutar ROLLBACK; y revisar con  SELECT id, CONCAT('[',nombre,']') FROM membresias;

COMMIT;


-- ── 2. VERIFICACIÓN (no modifica nada) ─────────────────────────────────────

-- 2.a Los 3 planes deben quedar en 1 mes con su precio y su price_id:
SELECT id,
       nombre,
       precio,
       duracion_meses,
       IFNULL(stripe_price_id, '(sin price)') AS stripe_price_id,
       CASE
         WHEN nombre IN ('Delux','Deluxe') AND precio = 199.00 AND duracion_meses = 1 THEN 'OK'
         WHEN nombre = 'Premium'           AND precio = 399.00 AND duracion_meses = 1 THEN 'OK'
         WHEN nombre = 'Empresarial'       AND precio = 699.00 AND duracion_meses = 1 THEN 'OK'
         WHEN precio = 0 OR precio IS NULL THEN 'plan sin cobro (no aplica)'
         ELSE '*** REVISAR ***'
       END AS resultado
  FROM membresias
 ORDER BY id;

--   Esperado:
--     Gratuita       0.00     -> plan sin cobro
--     Cortesia       0.00     -> plan sin cobro
--     Deluxe       199.00  1m -> OK
--     Premium      399.00  1m -> OK
--     Empresarial  699.00  1m -> OK
--     Plan Especial  NULL     -> plan sin cobro

-- 2.b Ningún plan de pago puede quedarse sin price_id (debe dar 0):
SELECT COUNT(*) AS planes_de_pago_sin_price
  FROM membresias
 WHERE precio > 0
   AND (stripe_price_id IS NULL OR stripe_price_id = '');


-- ── 3. ROLLBACK MANUAL (sólo si hay que revertir) ──────────────────────────
-- Valores exactos que tenía producción antes de esta migración.
-- Descomentar y ejecutar únicamente si es necesario volver atrás.
--
--   START TRANSACTION;
--   UPDATE membresias SET precio=300.00,  duracion_meses=6,  stripe_price_id=NULL
--    WHERE nombre IN ('Delux','Deluxe');
--   UPDATE membresias SET precio=599.00,  duracion_meses=12, stripe_price_id='price_1U6LDqEQi85l8GK2wiR5WyFj'
--    WHERE nombre='Premium';
--   UPDATE membresias SET precio=1299.00, duracion_meses=12, stripe_price_id='price_1U6LDtEQi85l8GK2gRE3oRvQ'
--    WHERE nombre='Empresarial';
--   COMMIT;


-- ── 4. DESPUÉS DE EJECUTAR ─────────────────────────────────────────────────
-- a) Reiniciar el servicio en Render para limpiar cachés.
-- b) Comprobar que los precios salen correctos en la API:
--      curl -s https://jelpycore.onrender.com/membresias
-- c) Revisar que el frontend no tenga precios escritos a mano: si el portal
--    muestra "$599 / año" en el HTML, seguirá mintiendo aunque la BD ya
--    esté bien. Los precios deben leerse de este endpoint.
--
-- NOTA — Plan Especial (id 6) tiene precio y duracion_meses en NULL. No se
-- toca aquí porque no está en Stripe. El código hace
-- `Number(duracion_meses) || 1`, así que se comporta como mensual. Si ese
-- plan se va a cobrar algún día, necesita su propio Price en Stripe.
-- ============================================================================
