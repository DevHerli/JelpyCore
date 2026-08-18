-- ============================================================
-- MIGRACIÓN: Facturación — tabla `facturas` + datos fiscales
-- Proyecto: Jelpy Core
-- Ticket: BILLING-002
-- Descripción: Crea la tabla que respalda a Factura (entity) y
--              asegura las columnas fiscales de `suscriptores`.
-- ============================================================
-- CAUSA QUE ESTA MIGRACIÓN RESUELVE
--   GET /facturas?suscriptorId=X devuelve HTTP 500 en producción.
--   El módulo `facturas` se agregó como entity de TypeORM, pero
--   `synchronize` está apagado en PROD (app.module.ts: DB_SYNC) y
--   nunca se escribió el DDL correspondiente: billing_001 sólo crea
--   billing_subscriptions y stripe_processed_events. Resultado:
--   TypeORM consulta una tabla inexistente → ER_NO_SUCH_TABLE (1146)
--   → excepción no controlada → 500.
--
-- El DDL de abajo replica exactamente
--   src/modules/facturas/entities/factura.entity.ts
-- Si esa entity cambia, esta migración tiene que cambiar con ella.
--
-- Ejecutar en orden. Idempotente: usa IF NOT EXISTS / IF EXISTS.
-- Sintaxis MariaDB (igual que billing_001). En MySQL 8 `ADD COLUMN IF
-- NOT EXISTS` no existe: ver la nota al final del bloque 1.

-- ── 0. Diagnóstico previo (opcional, para confirmar el estado) ─────────────
--   SHOW TABLES LIKE 'facturas';
--   -- 0 filas  → la tabla falta: es exactamente el bug de este ticket.
--   -- 1 fila   → existe: comparar columnas contra el bloque 2 antes de seguir,
--   --             porque entonces el 500 es un desajuste de esquema, no ausencia.


-- ── 1. suscriptores: columnas fiscales (Phase 3) ───────────────────────────
-- La entity Suscriptor ya declara estas 6 columnas y el portal las escribe vía
-- PUT /suscriptores/:id/datos-fiscales. Van con IF NOT EXISTS porque puede que
-- ya se hayan agregado a mano; si ya están, este bloque no hace nada.
ALTER TABLE suscriptores
  ADD COLUMN IF NOT EXISTS rfc VARCHAR(13) NULL
    COMMENT 'RFC del receptor del CFDI (12 morales / 13 físicas)',
  ADD COLUMN IF NOT EXISTS razon_social VARCHAR(150) NULL
    COMMENT 'Nombre o razón social tal como está en la Constancia de Situación Fiscal',
  ADD COLUMN IF NOT EXISTS uso_cfdi VARCHAR(10) NULL
    COMMENT 'Clave del catálogo c_UsoCFDI del SAT (G03, P01, ...)',
  ADD COLUMN IF NOT EXISTS regimen_fiscal VARCHAR(10) NULL
    COMMENT 'Clave del catálogo c_RegimenFiscal del SAT (601, 626, ...)',
  ADD COLUMN IF NOT EXISTS codigo_postal_fiscal VARCHAR(5) NULL
    COMMENT 'CP del domicilio fiscal — obligatorio para timbrar CFDI 4.0',
  ADD COLUMN IF NOT EXISTS email_fiscal VARCHAR(150) NULL
    COMMENT 'Correo al que se envían PDF y XML (puede diferir del de la cuenta)';

-- MySQL 8 no soporta `ADD COLUMN IF NOT EXISTS`. Si el servidor es MySQL,
-- revisar primero qué falta y agregar sólo esas columnas:
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suscriptores'
--      AND COLUMN_NAME IN ('rfc','razon_social','uso_cfdi',
--                          'regimen_fiscal','codigo_postal_fiscal','email_fiscal');


-- ── 2. facturas: historial de CFDI por suscriptor ──────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Dueño de la factura. La verificación de propiedad (JLP-H14) del servicio
  -- compara contra esta columna, así que no puede ser NULL.
  suscriptor_id   BIGINT UNSIGNED NOT NULL,
  -- Pago que origina la factura. Opcional: se puede solicitar una factura sin
  -- referenciar un pago, y si el pago se borra la factura debe sobrevivir
  -- (es un comprobante fiscal), de ahí SET NULL y no CASCADE.
  pago_id         BIGINT UNSIGNED NULL,

  folio           VARCHAR(50)  NULL COMMENT 'Folio interno o serie-folio del PAC',
  fecha           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                    COMMENT 'Alta del registro — @CreateDateColumn en la entity',
  concepto        VARCHAR(255) NULL,

  -- Importes en centavos enteros: evita el redondeo binario de FLOAT en dinero.
  -- INT soporta hasta ~21.4 millones de pesos por factura, de sobra aquí.
  total_centavos  INT NOT NULL DEFAULT 0 COMMENT 'Total en centavos MXN',

  estatus         ENUM('pendiente','emitida','cancelada') NOT NULL DEFAULT 'pendiente',

  pdf_url         VARCHAR(500) NULL,
  xml_url         VARCHAR(500) NULL,
  uuid_cfdi       VARCHAR(50)  NULL COMMENT 'Folio fiscal (UUID) que devuelve el PAC al timbrar',

  -- Snapshot fiscal al momento de emitir: si el suscriptor luego cambia su RFC,
  -- la factura ya emitida debe conservar los datos con los que se timbró.
  rfc             VARCHAR(13)  NULL,
  razon_social    VARCHAR(150) NULL,

  PRIMARY KEY (id),
  -- Mismo nombre que @Index en la entity, para que un DB_SYNC=true en QA no
  -- intente recrearlo.
  INDEX idx_facturas_suscriptor (suscriptor_id),
  INDEX idx_facturas_estatus    (estatus),

  CONSTRAINT fk_facturas_suscriptor
    FOREIGN KEY (suscriptor_id) REFERENCES suscriptores(id) ON DELETE CASCADE,
  CONSTRAINT fk_facturas_pago
    FOREIGN KEY (pago_id)       REFERENCES pagos(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Historial de facturas (CFDI) por suscriptor';

-- NOTA: `listar()` ordena por (fecha DESC, id DESC) filtrando por suscriptor.
-- Con el volumen actual el índice simple basta; si el historial crece, cambiar
-- idx_facturas_suscriptor por (suscriptor_id, fecha) resuelve el filesort.


-- ── Verificación post-migración ────────────────────────────────────────────
-- Esperado: facturas = 13 columnas, y 6 columnas fiscales en suscriptores.
SELECT
  'facturas'  AS objeto,
  COUNT(*)    AS columnas
FROM information_schema.COLUMNS
WHERE TABLE_NAME   = 'facturas'
  AND TABLE_SCHEMA = DATABASE()

UNION ALL

SELECT
  'suscriptores.datos_fiscales' AS objeto,
  COUNT(*)                      AS columnas
FROM information_schema.COLUMNS
WHERE TABLE_NAME   = 'suscriptores'
  AND TABLE_SCHEMA = DATABASE()
  AND COLUMN_NAME IN ('rfc','razon_social','uso_cfdi',
                      'regimen_fiscal','codigo_postal_fiscal','email_fiscal')

UNION ALL

SELECT
  'facturas.foreign_keys' AS objeto,
  COUNT(*)                AS columnas
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_NAME      = 'facturas'
  AND TABLE_SCHEMA    = DATABASE()
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';
