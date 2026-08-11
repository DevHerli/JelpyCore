-- ============================================================
-- MIGRACIÓN: Billing — Stripe Checkout + Subscriptions
-- Proyecto: Jelpy Core
-- Ticket: BILLING-001
-- Descripción: Tablas para suscripciones de pago por negocio
--              (Apple 3.1.1 compliant — web-only payments)
-- ============================================================
-- Ejecutar en orden. Idempotente: usa IF NOT EXISTS / IF EXISTS.

-- ── 1. membresías: mapeo con Stripe Price ──────────────────────────────────
ALTER TABLE membresías
  ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100) NULL
    COMMENT 'ID del Price recurrente mensual en Stripe (price_xxx). NULL = plan Free.'
  AFTER anuncios_ilimitados;

-- NOTA: Configurar stripe_price_id manualmente tras crear los Products en Stripe:
--   UPDATE membresías SET stripe_price_id = 'price_xxx' WHERE nombre = 'Delux';
--   UPDATE membresías SET stripe_price_id = 'price_yyy' WHERE nombre = 'Premium';
--   UPDATE membresías SET stripe_price_id = 'price_zzz' WHERE nombre = 'Empresarial';


-- ── 2. billing_subscriptions: estado de facturación por negocio ───────────
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Negocio al que aplica el plan
  negocio_id                  BIGINT UNSIGNED NOT NULL,
  -- Suscriptor dueño (denormalizado para queries rápidos)
  suscriptor_id               BIGINT UNSIGNED NOT NULL,
  -- Membresía/plan activo
  membresia_id                BIGINT UNSIGNED NOT NULL,

  -- Identificadores de Stripe
  stripe_subscription_id      VARCHAR(120) NULL  COMMENT 'sub_xxx',
  stripe_customer_id          VARCHAR(120) NULL  COMMENT 'cus_xxx',
  stripe_checkout_session_id  VARCHAR(120) NULL  COMMENT 'cs_xxx',

  -- Estado del plan
  plan_estatus                ENUM('activo','pago_pendiente','vencido') NOT NULL DEFAULT 'activo',
  plan_vigente_hasta          DATE NULL          COMMENT 'current_period_end de Stripe',
  ultimo_monto_mxn            DECIMAL(10,2) NULL COMMENT 'Monto MXN del último invoice pagado',

  fecha_creacion              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion         DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_bs_stripe_sub (stripe_subscription_id),
  INDEX idx_bs_negocio       (negocio_id),
  INDEX idx_bs_suscriptor    (suscriptor_id),
  INDEX idx_bs_stripe_customer (stripe_customer_id),

  CONSTRAINT fk_bs_negocio
    FOREIGN KEY (negocio_id)   REFERENCES negocios(id)    ON DELETE CASCADE,
  CONSTRAINT fk_bs_suscriptor
    FOREIGN KEY (suscriptor_id) REFERENCES suscriptores(id) ON DELETE CASCADE,
  CONSTRAINT fk_bs_membresia
    FOREIGN KEY (membresia_id)  REFERENCES membresías(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Estado de la suscripción de Stripe por negocio';


-- ── 3. stripe_processed_events: idempotencia de webhooks ─────────────────
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  stripe_event_id VARCHAR(100)    NOT NULL COMMENT 'evt_xxx — ID único del evento de Stripe',
  event_type      VARCHAR(80)     NOT NULL COMMENT 'checkout.session.completed, invoice.paid, etc.',
  status          ENUM('success','error') NOT NULL DEFAULT 'success',
  error_message   TEXT NULL,
  fecha_procesado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_spe_event_id (stripe_event_id),
  INDEX idx_spe_event_type (event_type),
  INDEX idx_spe_fecha (fecha_procesado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Log de eventos de Stripe procesados (idempotencia de webhooks)';


-- ── Verificación post-migración ────────────────────────────────────────────
SELECT
  'billing_subscriptions'    AS tabla,
  COUNT(*)                   AS columnas
FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'billing_subscriptions'
  AND TABLE_SCHEMA = DATABASE()

UNION ALL

SELECT
  'stripe_processed_events'  AS tabla,
  COUNT(*)                   AS columnas
FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'stripe_processed_events'
  AND TABLE_SCHEMA = DATABASE()

UNION ALL

SELECT
  'membresías.stripe_price_id' AS tabla,
  COUNT(*)                     AS columnas
FROM information_schema.COLUMNS
WHERE TABLE_NAME   = 'membresías'
  AND COLUMN_NAME  = 'stripe_price_id'
  AND TABLE_SCHEMA = DATABASE();
