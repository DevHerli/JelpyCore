-- ============================================================================
-- MIGRACIÓN: data_007 — límites reales de cuotas por membresía (negocios,
--   promociones, anuncios, sucursales) + fix de reset_periodo
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- EL PROBLEMA
--   1) `consumirCuota()` (suscripciones.service.ts) está completamente
--      implementado (transaccional, con lock pesimista) desde hace tiempo,
--      pero NUNCA se invoca en los flujos reales de creación de negocios,
--      promociones o anuncios — sólo se expone en un endpoint manual
--      (POST /suscripciones/consumir) que nadie llama. Es decir: hoy CUALQUIER
--      suscriptor puede crear negocios/promociones sin límite, sin importar su
--      membresía. Confirmado por código: no hay una sola llamada a
--      consumirCuota() fuera de ese endpoint manual y del cálculo de display
--      del resumen.
--
--   2) Los valores actuales de `membresia_cuotas` no reflejan ningún negocio
--      real acordado — de hecho son contradictorios con el negocio:
--        · Empresarial (5) y Plan Especial (6): max_negocios=0,
--          max_promociones=0, max_anuncios=0 — ni un plan de pago más caro
--          puede operar NADA.
--        · Cortesía (2): max_negocios=1 — pero el suscriptor 8 (admin,
--          Cortesía) ya tiene 17 negocios reales dados de alta como
--          back-office (ver data_005). Conectar consumirCuota() sin resolver
--          esto primero habría roto ese flujo de inmediato.
--
--   3) `reset_periodo='mensual'` en las 6 membresías. Bajo ese esquema,
--      max_negocios NO es un tope real: `consumirCuota()` crea un
--      `suscripcion_ciclos` nuevo cada mes con usados=0, así que un
--      suscriptor con "máximo 1 negocio" podría crear un negocio nuevo cada
--      mes indefinidamente. negocios/promociones son recursos que persisten
--      (no se "consumen" y renuevan como un cupo de publicidad mensual) — el
--      reset mensual sólo tiene sentido conceptual para anuncios, que YA
--      tienen su propio motor independiente (`anuncios_cupo_mensual`,
--      basado en `membresias.anuncios_mensuales`, no en este ciclo).
--
-- QUÉ CAMBIA
--   A) `membresia_cuotas`: se agrega la columna `max_sucursales` (límite de
--      sucursales que puede dar de alta CADA negocio, según la membresía de
--      su dueño — chequeo en vivo por COUNT(*), no por este motor de ciclos,
--      ver comentario en membresia-cuotas.entity.ts).
--
--   B) `membresia_cuotas`: se actualizan max_negocios/max_promociones/
--      max_anuncios/max_sucursales a la tabla acordada con el equipo:
--
--        Membresía        max_negocios  max_promociones  max_anuncios  max_sucursales
--        Gratuita   (1)    1             0                0             1
--        Cortesía   (2)    1             2                2             2
--        Deluxe     (3)    2             3                3             3
--        Premium    (4)    5             5                5             5
--        Empresarial(5)    6             6                6             6
--        Plan Esp.  (6)    7             7                7             7
--
--   C) `membresia_cuotas.reset_periodo` -> 'una_vez' en las 6 filas. Con
--      calcularRangoCiclo('una_vez') el ciclo cubre 1-ene-<año actual> hasta
--      31-dic-2099 — en la práctica un tope de por vida mientras la
--      suscripción siga activa, que es el comportamiento correcto para
--      "máximo N negocios/promociones". (Ver trade-off en el punto D.)
--
--   D) `membresias.anuncios_mensuales` se sincroniza con el nuevo
--      max_anuncios de la tabla de arriba, y `anuncios_ilimitados` se apaga
--      (pasa a 0) en Premium/Empresarial/Plan Especial — hoy esos 3 planes
--      tenían `anuncios_ilimitados=1`, lo que los hacía ilimitados de verdad
--      pase lo que pase en `max_anuncios`. La tabla acordada da un número
--      finito para las 6 membresías, así que se interpreta como "ya no hay
--      ilimitados": se apaga la bandera para que el número finito aplique de
--      verdad. Esto alimenta el motor YA EXISTENTE de anuncios
--      (`anuncios_cupo_mensual` / `AnunciosService.ensureMonthlyQuota`), que
--      no se toca — sólo se corrige su configuración.
--
-- TRADE-OFF A propósito (documentado, no es un bug):
--   negocios_usados/promociones_usadas NUNCA decrementan al borrar un
--   negocio/promoción (consumirCuota() sólo incrementa). Con reset_periodo=
--   'una_vez' esto significa: si un suscriptor gasta su cupo y luego borra
--   uno de sus negocios/promociones, NO recupera el cupo automáticamente.
--   Se documenta como deuda conocida — v1 aceptable para lanzamiento; si se
--   vuelve un problema real de soporte, la solución sería mover a un COUNT(*)
--   en vivo (como ya se hizo aquí mismo para sucursales) en vez del contador
--   acumulado de `suscripcion_ciclos`.
--
--   Las sucursales SÍ usan COUNT(*) en vivo (no este motor), así que ahí no
--   aplica este trade-off: borrar una sucursal libera el cupo de inmediato.
--
-- BYPASS DE ADMIN
--   El suscriptor 8 (role='admin', ver data_005) queda exento de los 4
--   límites por diseño explícito en el código (NegociosController.crear(),
--   PromocionesNegociosService.create(), SucursalesNegociosService.crear()
--   saltan el chequeo si requester.isAdmin === true) — sigue pudiendo operar
--   sin tope como cuenta de back-office, tal como ya se estableció en
--   data_005.
--
-- SEGURIDAD
--   Backups de los valores previos en:
--     .local/backups/membresia_cuotas-PROD-<timestamp>.sql
--     .local/backups/membresias-anuncios-PROD-<timestamp>.sql
--   (gitignored, INSERTs/UPDATEs listos para revertir cada fila exacta).
--   ALTER TABLE es aditivo (ADD COLUMN ... DEFAULT 0), no destructivo.
--   UPDATEs acotados por id, dentro de una transacción, verificados antes de
--   COMMIT.
-- ============================================================================


-- ── 0. Verificación previa (no modifica nada) ──────────────────────────────
SELECT DATABASE() AS base_actual;   -- debe decir: jelpymx_core_assistant

SELECT mc.id, mc.membresia_id, m.nombre, mc.max_negocios, mc.max_promociones,
       mc.max_anuncios, mc.reset_periodo
  FROM membresia_cuotas mc JOIN membresias m ON m.id = mc.membresia_id
 ORDER BY mc.membresia_id;

SELECT id, nombre, anuncios_mensuales, anuncios_ilimitados FROM membresias ORDER BY id;


-- ── 1. ALTER TABLE (aditivo) ────────────────────────────────────────────────
ALTER TABLE membresia_cuotas
  ADD COLUMN max_sucursales INT NOT NULL DEFAULT 0 AFTER max_anuncios;


-- ── 2. UPDATE membresia_cuotas (6 filas) ────────────────────────────────────
UPDATE membresia_cuotas SET max_negocios=1, max_promociones=0, max_anuncios=0, max_sucursales=1, reset_periodo='una_vez' WHERE membresia_id=1; -- Gratuita
UPDATE membresia_cuotas SET max_negocios=1, max_promociones=2, max_anuncios=2, max_sucursales=2, reset_periodo='una_vez' WHERE membresia_id=2; -- Cortesia
UPDATE membresia_cuotas SET max_negocios=2, max_promociones=3, max_anuncios=3, max_sucursales=3, reset_periodo='una_vez' WHERE membresia_id=3; -- Deluxe
UPDATE membresia_cuotas SET max_negocios=5, max_promociones=5, max_anuncios=5, max_sucursales=5, reset_periodo='una_vez' WHERE membresia_id=4; -- Premium
UPDATE membresia_cuotas SET max_negocios=6, max_promociones=6, max_anuncios=6, max_sucursales=6, reset_periodo='una_vez' WHERE membresia_id=5; -- Empresarial
UPDATE membresia_cuotas SET max_negocios=7, max_promociones=7, max_anuncios=7, max_sucursales=7, reset_periodo='una_vez' WHERE membresia_id=6; -- Plan Especial


-- ── 3. UPDATE membresias (sincroniza motor de anuncios ya existente) ───────
UPDATE membresias SET anuncios_mensuales=0, anuncios_ilimitados=0 WHERE id=1; -- Gratuita
UPDATE membresias SET anuncios_mensuales=2, anuncios_ilimitados=0 WHERE id=2; -- Cortesia
UPDATE membresias SET anuncios_mensuales=3, anuncios_ilimitados=0 WHERE id=3; -- Deluxe
UPDATE membresias SET anuncios_mensuales=5, anuncios_ilimitados=0 WHERE id=4; -- Premium
UPDATE membresias SET anuncios_mensuales=6, anuncios_ilimitados=0 WHERE id=5; -- Empresarial
UPDATE membresias SET anuncios_mensuales=7, anuncios_ilimitados=0 WHERE id=6; -- Plan Especial


-- ── 4. Verificación posterior (no modifica nada) ────────────────────────────
SELECT mc.id, mc.membresia_id, m.nombre, mc.max_negocios, mc.max_promociones,
       mc.max_anuncios, mc.max_sucursales, mc.reset_periodo
  FROM membresia_cuotas mc JOIN membresias m ON m.id = mc.membresia_id
 ORDER BY mc.membresia_id;
--   Esperado: los 6 valores de la tabla del punto B, reset_periodo='una_vez'.

SELECT id, nombre, anuncios_mensuales, anuncios_ilimitados FROM membresias ORDER BY id;
--   Esperado: anuncios_ilimitados=0 en las 6, anuncios_mensuales = max_anuncios.


-- ── 5. Rollback manual (restaurar desde el backup) ─────────────────────────
--   Ejecutar el contenido de:
--     .local/backups/membresia_cuotas-PROD-<timestamp>.sql
--     .local/backups/membresias-anuncios-PROD-<timestamp>.sql
--   (nota: esos backups NO revierten el ALTER TABLE — max_sucursales se
--   puede dejar en su lugar sin efecto, ya que ningún código la lee si se
--   revierte también el commit de negocios.controller.ts /
--   sucursales-negocios.service.ts que la consume. Si hiciera falta
--   eliminarla: ALTER TABLE membresia_cuotas DROP COLUMN max_sucursales;)
-- ============================================================================
