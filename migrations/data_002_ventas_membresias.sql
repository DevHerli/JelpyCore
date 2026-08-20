-- ============================================================================
-- MIGRACIÓN: data_002 — crea la tabla `ventas_membresias`, que nunca existió
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- QUÉ PASA HOY
--   La entity VentaMembresia mapea a `ventas_membresias` y el módulo está
--   registrado en app.module.ts, pero la tabla NO EXISTE en la base:
--
--     [ER_NO_SUCH_TABLE] Table 'jelpymx_core_assistant.ventas_membresias'
--     doesn't exist
--
--   Las 6 rutas del módulo devuelven 500 desde siempre:
--     POST /ventas/membresias/registrar
--     GET  /ventas/membresias/resumen
--     GET  /ventas/membresias/por-suscriptor
--     GET  /ventas/membresias/por-negocio
--     GET  /ventas/membresias/reporte-ciudad
--     GET  /ventas/membresias/reporte-mensual
--     GET  /ventas/membresias/reporte-anual
--
--   Como nunca funcionaron, ningún cliente puede depender de ellas: no hay
--   datos que perder ni comportamiento que romper.
--
-- EL DDL SALE DE LA ENTITY, NO DE UNA SUPOSICIÓN
--   Cada columna corresponde 1:1 con
--   src/modules/sales/ventas_membresias/entities/ventas-membresia.entity.ts.
--   Los tipos de las FK (bigint(20) unsigned) se verificaron contra los PK
--   reales de suscriptores, negocios, membresias y ciudades: si no coinciden
--   exactamente, MySQL rechaza la constraint con errno 150.
--
-- DECISIÓN PENDIENTE — LEER ANTES DE EJECUTAR
--   Esta tabla registra ventas de membresía, que es lo mismo que ya llevan
--   billing_subscriptions, suscriptor_suscripciones, suscripcion_ciclos y
--   estado_cuenta_movimientos desde la integración con Stripe. Nada en el
--   backend escribe aquí: sólo se llena si el panel de admin llama a
--   POST /ventas/membresias/registrar.
--
--   Crear la tabla es la opción reversible (un DROP la quita y no había datos).
--   La alternativa —retirar el módulo— es la que hay que evaluar con calma,
--   porque implica decidir si el reporte de ventas se reconstruye sobre las
--   tablas de billing. Se crea la tabla para no bloquear, pero la consolidación
--   sigue pendiente.
--
-- SEGURIDAD
--   Idempotente (CREATE TABLE IF NOT EXISTS). Sin DROP. Sin datos.
-- ============================================================================


-- ── 0. ANTES DE EJECUTAR (no modifica nada) ────────────────────────────────

SELECT DATABASE() AS base_actual;
--     Debe decir: jelpymx_core_assistant

-- ¿Ya existe? (0 = no existe, es lo esperado la primera vez)
SELECT COUNT(*) AS ya_existe
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'ventas_membresias';


-- ── 1. CREACIÓN ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ventas_membresias (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Quién compra. eager en la entity, obligatorio.
  suscriptor_id     BIGINT UNSIGNED NOT NULL,
  -- Negocio al que se aplica la membresía. Opcional en la entity.
  negocio_id        BIGINT UNSIGNED NULL,
  -- Plan comprado. eager en la entity, obligatorio.
  membresia_id      BIGINT UNSIGNED NOT NULL,
  -- Ciudad, para los reportes por plaza. Opcional.
  ciudad_id         BIGINT UNSIGNED NULL,

  -- Importe cobrado. DECIMAL y no float: en dinero el binario redondea mal.
  monto             DECIMAL(10,2) NOT NULL,

  metodo_pago       VARCHAR(50)  NOT NULL DEFAULT 'tarjeta',
  -- Los reportes filtran por estatus = 'pagado'.
  estatus           VARCHAR(50)  NOT NULL DEFAULT 'pagado',

  fecha_compra      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- La calcula el servicio a partir de membresias.duracion_meses.
  fecha_expiracion  DATETIME     NULL,

  PRIMARY KEY (id),

  -- Índice compuesto para los reportes: todos filtran por estatus y agrupan
  -- o acotan por fecha_compra.
  KEY idx_vm_estatus_fecha (estatus, fecha_compra),
  KEY idx_vm_suscriptor    (suscriptor_id, fecha_compra),
  KEY idx_vm_negocio       (negocio_id, fecha_compra),
  KEY idx_vm_membresia     (membresia_id),
  KEY idx_vm_ciudad        (ciudad_id),

  -- Si se borra el suscriptor o el negocio, su historial de ventas se va con
  -- ellos. La membresía y la ciudad se protegen con RESTRICT: son catálogo,
  -- borrar un plan no debe borrar el registro de lo que se vendió.
  CONSTRAINT fk_vm_suscriptor
    FOREIGN KEY (suscriptor_id) REFERENCES suscriptores(id) ON DELETE CASCADE,
  CONSTRAINT fk_vm_negocio
    FOREIGN KEY (negocio_id)    REFERENCES negocios(id)     ON DELETE CASCADE,
  CONSTRAINT fk_vm_membresia
    FOREIGN KEY (membresia_id)  REFERENCES membresias(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_vm_ciudad
    FOREIGN KEY (ciudad_id)     REFERENCES ciudades(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ventas de membresías registradas desde el panel de administración';


-- ── 2. VERIFICACIÓN (no modifica nada) ─────────────────────────────────────

-- 2.a La tabla debe existir con sus 10 columnas:
SELECT IF(COUNT(*) = 10, 'OK - 10 columnas', CONCAT('*** REVISAR: ', COUNT(*), ' columnas ***'))
         AS ventas_membresias
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'ventas_membresias';

-- 2.b Las 4 claves foráneas deben haberse creado:
SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
  FROM information_schema.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'ventas_membresias'
   AND REFERENCED_TABLE_NAME IS NOT NULL
 ORDER BY CONSTRAINT_NAME;
--   Esperado: fk_vm_ciudad -> ciudades, fk_vm_membresia -> membresias,
--             fk_vm_negocio -> negocios, fk_vm_suscriptor -> suscriptores

-- 2.c La consulta que hace el reporte debe correr (devolverá 0 filas):
SELECT m.nombre AS membresia,
       COUNT(v.id)  AS total_vendidas,
       SUM(v.monto) AS total_recaudado
  FROM ventas_membresias v
 INNER JOIN membresias m ON m.id = v.membresia_id
 WHERE v.estatus = 'pagado'
 GROUP BY m.nombre;


-- ── 3. ROLLBACK MANUAL (sólo si hay que revertir) ──────────────────────────
-- La tabla se crea vacía, así que eliminarla no pierde nada. Verificar que
-- sigue vacía antes de ejecutar el DROP.
--
--   SELECT COUNT(*) FROM ventas_membresias;   -- debe dar 0
--   DROP TABLE IF EXISTS ventas_membresias;


-- ── 4. DESPUÉS DE EJECUTAR ─────────────────────────────────────────────────
-- a) Desplegar el código: junto con esta migración va la corrección de una
--    inyección SQL en los reportes de este mismo módulo
--    (ventas-membresias.service.ts). Los filtros de fecha llegaban como texto
--    crudo y se concatenaban al SQL; ahora van parametrizados.
-- b) Decidir la consolidación con las tablas de billing (ver arriba).
-- ============================================================================
