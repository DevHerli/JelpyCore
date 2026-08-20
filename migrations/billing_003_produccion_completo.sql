-- ============================================================================
-- MIGRACIÓN: billing_003 — Stripe + facturación + saldos + vencimiento
-- Proyecto: Jelpy Core
-- BASE DE DATOS DESTINO: jelpymx_core_assistant   <-- PRODUCCIÓN (la de Render)
-- ============================================================================
--
-- POR QUÉ EXISTE ESTE ARCHIVO
--   billing_001 y billing_002 se aplicaron por error sobre la base de QA
--   (qajelpym_databaseCore), no sobre producción. Evidencia: el MISMO build
--   responde 200 en /membresias contra QA y 500 contra producción, porque en
--   producción falta membresias.stripe_price_id (ER_BAD_FIELD_ERROR 1054).
--
--   Este archivo consolida TODO lo que producción necesita, en un solo paso.
--
-- CÓMO SE GENERÓ
--   El DDL de las tablas NO está escrito a mano: se extrajo con
--   SHOW CREATE TABLE desde el esquema de QA ya verificado funcionando
--   (GET /membresias -> 200 con los price IDs). Por eso coincide exactamente
--   con lo que las entities de TypeORM esperan.
--
-- SEGURIDAD
--   Idempotente: usa IF NOT EXISTS en tablas y columnas. Volver a ejecutarlo
--   no destruye datos. NO contiene ningún DROP.
--   Sintaxis MariaDB (producción corre MariaDB 11.4).
--
-- ORDEN DE EJECUCIÓN: de arriba hacia abajo, sin saltarse bloques.
-- ============================================================================


-- ── 0. DIAGNÓSTICO PREVIO (ejecutar primero, no modifica nada) ──────────────
-- Confirma que estás en la base correcta ANTES de escribir:
SELECT DATABASE() AS base_actual;
--   Debe decir: jelpymx_core_assistant
--   Si dice qajelpym_databaseCore, DETENTE: es QA.

-- Qué falta actualmente:
SELECT 'membresias.stripe_price_id' AS objeto,
       IF(COUNT(*) > 0, 'ya existe', 'FALTA') AS estado
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'membresias'
   AND COLUMN_NAME  = 'stripe_price_id'
UNION ALL
SELECT t.nombre,
       IF(COUNT(c.TABLE_NAME) > 0, 'ya existe', 'FALTA')
  FROM (SELECT 'billing_subscriptions' AS nombre
        UNION ALL SELECT 'stripe_processed_events'
        UNION ALL SELECT 'facturas'
        UNION ALL SELECT 'suscriptor_suscripciones'
        UNION ALL SELECT 'suscripcion_ciclos'
        UNION ALL SELECT 'estado_cuenta_movimientos') t
  LEFT JOIN information_schema.TABLES c
         ON c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = t.nombre
 GROUP BY t.nombre;


-- ── 1. membresias: columna stripe_price_id ─────────────────────────────────
-- OJO: la tabla es `membresias` SIN acento (@Entity('membresias')).
-- billing_001 la escribía con acento y fallaba en silencio.
ALTER TABLE membresias
  ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100) NULL
    COMMENT 'Price recurrente en Stripe (price_xxx). NULL = plan sin cobro.'
  AFTER anuncios_ilimitados;


-- ── 2. suscriptores: datos fiscales para CFDI ──────────────────────────────
ALTER TABLE suscriptores
  ADD COLUMN IF NOT EXISTS rfc                   VARCHAR(13)  NULL COMMENT 'RFC del receptor',
  ADD COLUMN IF NOT EXISTS razon_social          VARCHAR(255) NULL COMMENT 'Razón social fiscal',
  ADD COLUMN IF NOT EXISTS uso_cfdi              VARCHAR(10)  NULL COMMENT 'Clave de uso CFDI (ej. G03)',
  ADD COLUMN IF NOT EXISTS regimen_fiscal        VARCHAR(10)  NULL COMMENT 'Clave de régimen fiscal (ej. 601)',
  ADD COLUMN IF NOT EXISTS codigo_postal_fiscal  VARCHAR(10)  NULL COMMENT 'CP del domicilio fiscal',
  ADD COLUMN IF NOT EXISTS email_fiscal          VARCHAR(255) NULL COMMENT 'Correo para enviar el CFDI';


-- ── 3. TABLAS ──────────────────────────────────────────────────────────────
-- DDL extraído de QA (ya verificado). Las tablas de suscripciones
-- probablemente ya existen en producción: IF NOT EXISTS las deja intactas.

-- ── billing_subscriptions ─────────────────────────────────────────
-- Estado de facturación Stripe por negocio (suscripción activa, periodo, cancelación).
CREATE TABLE IF NOT EXISTS `billing_subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `negocio_id` bigint(20) unsigned NOT NULL,
  `suscriptor_id` bigint(20) unsigned NOT NULL,
  `membresia_id` bigint(20) unsigned NOT NULL,
  `stripe_subscription_id` varchar(120) DEFAULT NULL COMMENT 'sub_xxx',
  `stripe_customer_id` varchar(120) DEFAULT NULL COMMENT 'cus_xxx',
  `stripe_checkout_session_id` varchar(120) DEFAULT NULL COMMENT 'cs_xxx',
  `plan_estatus` enum('activo','pago_pendiente','vencido') NOT NULL DEFAULT 'activo',
  `plan_vigente_hasta` date DEFAULT NULL COMMENT 'current_period_end de Stripe',
  `ultimo_monto_mxn` decimal(10,2) DEFAULT NULL COMMENT 'Monto MXN del último invoice pagado',
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bs_stripe_sub` (`stripe_subscription_id`),
  KEY `idx_bs_negocio` (`negocio_id`),
  KEY `idx_bs_suscriptor` (`suscriptor_id`),
  KEY `idx_bs_stripe_customer` (`stripe_customer_id`),
  KEY `fk_bs_membresia` (`membresia_id`),
  CONSTRAINT `fk_bs_membresia` FOREIGN KEY (`membresia_id`) REFERENCES `membresias` (`id`),
  CONSTRAINT `fk_bs_negocio` FOREIGN KEY (`negocio_id`) REFERENCES `negocios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bs_suscriptor` FOREIGN KEY (`suscriptor_id`) REFERENCES `suscriptores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Estado de la suscripción de Stripe por negocio';


-- ── stripe_processed_events ─────────────────────────────────────────
-- Idempotencia de webhooks: evita procesar dos veces el mismo evento de Stripe.
CREATE TABLE IF NOT EXISTS `stripe_processed_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `stripe_event_id` varchar(100) NOT NULL COMMENT 'evt_xxx — ID único del evento de Stripe',
  `event_type` varchar(80) NOT NULL COMMENT 'checkout.session.completed, invoice.paid, etc.',
  `status` enum('success','error') NOT NULL DEFAULT 'success',
  `error_message` text DEFAULT NULL,
  `fecha_procesado` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_spe_event_id` (`stripe_event_id`),
  KEY `idx_spe_event_type` (`event_type`),
  KEY `idx_spe_fecha` (`fecha_procesado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log de eventos de Stripe procesados (idempotencia de webhooks)';


-- ── facturas ─────────────────────────────────────────
-- Historial de comprobantes (CFDI) por suscriptor.
CREATE TABLE IF NOT EXISTS `facturas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `suscriptor_id` bigint(20) unsigned NOT NULL,
  `pago_id` bigint(20) unsigned DEFAULT NULL,
  `folio` varchar(50) DEFAULT NULL COMMENT 'Folio interno o serie-folio del PAC',
  `fecha` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Alta del registro — @CreateDateColumn en la entity',
  `concepto` varchar(255) DEFAULT NULL,
  `total_centavos` int(11) NOT NULL DEFAULT 0 COMMENT 'Total en centavos MXN',
  `estatus` enum('pendiente','emitida','cancelada') NOT NULL DEFAULT 'pendiente',
  `pdf_url` varchar(500) DEFAULT NULL,
  `xml_url` varchar(500) DEFAULT NULL,
  `uuid_cfdi` varchar(50) DEFAULT NULL COMMENT 'Folio fiscal (UUID) que devuelve el PAC al timbrar',
  `rfc` varchar(13) DEFAULT NULL,
  `razon_social` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_facturas_suscriptor` (`suscriptor_id`),
  KEY `idx_facturas_estatus` (`estatus`),
  KEY `fk_facturas_pago` (`pago_id`),
  CONSTRAINT `fk_facturas_pago` FOREIGN KEY (`pago_id`) REFERENCES `pagos` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_facturas_suscriptor` FOREIGN KEY (`suscriptor_id`) REFERENCES `suscriptores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Historial de facturas (CFDI) por suscriptor';


-- ── suscriptor_suscripciones ─────────────────────────────────────────
-- FECHA DE VENCIMIENTO: fecha_fin y proxima_fecha_corte + estatus del plan.
CREATE TABLE IF NOT EXISTS `suscriptor_suscripciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `estatus` enum('activa','en_mora','cancelada','expirada','prueba') NOT NULL DEFAULT 'activa',
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `proxima_fecha_corte` date DEFAULT NULL,
  `renovacion_automatica` tinyint(1) NOT NULL DEFAULT 0,
  `proveedor_pago` varchar(30) DEFAULT NULL,
  `proveedor_suscripcion_id` varchar(120) DEFAULT NULL,
  `fecha_creacion` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `fecha_actualizacion` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `suscriptor_id` bigint(20) unsigned DEFAULT NULL,
  `membresia_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ss_corte` (`proxima_fecha_corte`),
  KEY `idx_ss_estatus` (`estatus`),
  KEY `idx_ss_suscriptor` (`suscriptor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;


-- ── suscripcion_ciclos ─────────────────────────────────────────
-- Consumo por ciclo (negocios/promos/anuncios usados y extras).
CREATE TABLE IF NOT EXISTS `suscripcion_ciclos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `ciclo_inicio` date NOT NULL,
  `ciclo_fin` date NOT NULL,
  `negocios_usados` int(11) NOT NULL DEFAULT 0,
  `promociones_usadas` int(11) NOT NULL DEFAULT 0,
  `anuncios_usados` int(11) NOT NULL DEFAULT 0,
  `negocios_extra` int(11) NOT NULL DEFAULT 0,
  `promociones_extra` int(11) NOT NULL DEFAULT 0,
  `anuncios_extra` int(11) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime(6) NOT NULL DEFAULT current_timestamp(6),
  `fecha_actualizacion` datetime(6) DEFAULT current_timestamp(6) ON UPDATE current_timestamp(6),
  `suscripcion_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sc_rango` (`ciclo_inicio`,`ciclo_fin`),
  KEY `idx_sc_suscripcion` (`suscripcion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;


-- ── estado_cuenta_movimientos ─────────────────────────────────────────
-- SALDOS: cargos, abonos y saldo_despues_centavos por suscriptor.
CREATE TABLE IF NOT EXISTS `estado_cuenta_movimientos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `suscriptor_id` bigint(20) unsigned NOT NULL,
  `tipo_movimiento` enum('cargo','abono','ajuste','reembolso') NOT NULL,
  `referencia_tabla` varchar(50) DEFAULT NULL,
  `referencia_id` bigint(20) unsigned DEFAULT NULL,
  `descripcion` varchar(255) NOT NULL,
  `cargo_centavos` int(11) NOT NULL DEFAULT 0,
  `abono_centavos` int(11) NOT NULL DEFAULT 0,
  `saldo_despues_centavos` int(11) NOT NULL DEFAULT 0,
  `moneda` varchar(10) NOT NULL DEFAULT 'MXN',
  `fecha_creacion` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ecm_suscriptor` (`suscriptor_id`,`fecha_creacion`),
  CONSTRAINT `FK_59226634965210caab744310fb6` FOREIGN KEY (`suscriptor_id`) REFERENCES `suscriptores` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── 4. Price IDs de Stripe (los tuyos, ya creados en el dashboard) ─────────
-- Gratis y Cortesía se quedan en NULL a propósito: no se cobran.
-- Delux — $199 MXN/mes — producto prod_V6YKt2Mtxl6Akl
UPDATE membresias SET stripe_price_id = 'price_1U6LDoEQi85l8GK22f4tZqdG' WHERE nombre = 'Delux';

-- Premium — $399 MXN/mes — producto prod_V6YKAyEgcv4Xcg
UPDATE membresias SET stripe_price_id = 'price_1U6LDqEQi85l8GK2wiR5WyFj' WHERE nombre = 'Premium';

-- Empresarial — $699 MXN/mes — producto prod_V6YKYBzgpwP56I
UPDATE membresias SET stripe_price_id = 'price_1U6LDtEQi85l8GK2gRE3oRvQ' WHERE nombre = 'Empresarial';

-- Cada UPDATE debe reportar "1 row affected". Si alguno dice 0, el plan tiene
-- otro nombre en esta base: revisar con  SELECT id, nombre FROM membresias;


-- ── 5. VERIFICACIÓN FINAL (no modifica nada) ───────────────────────────────
-- 5.a Los 3 planes de pago deben tener price, los 2 gratuitos NULL:
SELECT id, nombre, precio, duracion_meses,
       IFNULL(stripe_price_id, '(NULL - plan sin cobro)') AS stripe_price_id
  FROM membresias
 ORDER BY id;

-- 5.b Las 6 tablas deben aparecer con su número de columnas:
SELECT TABLE_NAME AS tabla, COUNT(*) AS columnas
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('billing_subscriptions','stripe_processed_events','facturas',
                      'suscriptor_suscripciones','suscripcion_ciclos','estado_cuenta_movimientos')
 GROUP BY TABLE_NAME
 ORDER BY TABLE_NAME;
-- Esperado: billing_subscriptions 12 | estado_cuenta_movimientos 11 | facturas 13
--           stripe_processed_events 6 | suscripcion_ciclos 12 | suscriptor_suscripciones 12

-- 5.c Datos fiscales en suscriptores (deben ser 6):
SELECT COUNT(*) AS columnas_fiscales
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suscriptores'
   AND COLUMN_NAME IN ('rfc','razon_social','uso_cfdi','regimen_fiscal',
                       'codigo_postal_fiscal','email_fiscal');


-- ── 6. DESPUÉS DE EJECUTAR ─────────────────────────────────────────────────
-- a) Reiniciar el servicio en Render (Manual Deploy > Clear build cache).
-- b) Comprobar que el 500 desapareció:
--      curl -s -o /dev/null -w "%{http_code}\n" https://jelpycore.onrender.com/membresias
--    Debe responder 200.
-- c) Variables de entorno pendientes en Render:
--      STRIPE_BILLING_WEBHOOK_SECRET=whsec_...   (del webhook de Stripe)
--      WEB_URL=https://jelpy.mx
--      NODE_ENV=production
-- d) Webhook en Stripe apuntando a:
--      https://jelpycore.onrender.com/billing/webhook
-- ============================================================================
