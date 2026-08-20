-- ============================================================================
-- MIGRACIÓN: data_001 — asigna estado "Activo" a los suscriptores sin status
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- QUÉ HACE
--   Pone estado_id = 1 ('Activo') en los suscriptores que quedaron con
--   estado_id NULL. En producción son 3 filas: ids 11, 12 y 13.
--
-- POR QUÉ ESTÁN EN NULL
--   `estados` NO es un catálogo geográfico, es de status (id 1 = 'Activo').
--   Ninguno de los tres caminos de alta asignaba estado:
--
--     1. SuscriptoresService.crear()          (alta por API)
--          estado: dto.estadoId ? {id: dto.estadoId} : null
--          -> delegaba el status en el cliente; si no lo mandaba, NULL.
--     2. AuthService.verifyOtpRegister()      (registro por OTP — el de la app)
--          ni siquiera incluía el campo. ESTE es el origen de los 3 registros.
--     3. AuthService (login OTP que crea la cuenta al vuelo)
--          mismo caso.
--
--   Los tres quedaron corregidos en código con default server-side
--   (ESTADOS_SUSCRIPTOR.ACTIVO en src/common/constants/estados.constants.ts).
--   Esta migración sanea lo que ya está guardado.
--
-- POR QUÉ "Activo" Y NO "Pendiente"
--   Los tres tienen ultimo_login poblado: han iniciado sesión de verdad
--   (id 13 el 2026-08-18). Una cuenta que autentica está activa. Su
--   registro_completo = 0 es información aparte —les falta llenar el perfil—
--   y esa columna ya lo refleja; no hay que duplicar ese dato en el status.
--
-- ALCANCE / RIESGO
--   Hoy ningún guard ni endpoint lee suscriptores.estado_id (la autenticación
--   usa `eliminado` y `role`), así que el cambio no altera ningún permiso ni
--   comportamiento actual. Se aplica para que un futuro
--   `WHERE estado_id = 1` no deje fuera a usuarios legítimos.
--
-- SEGURIDAD
--   Idempotente (el WHERE ... IS NULL hace que la 2a corrida afecte 0 filas).
--   Transaccional. Sin DROP. No toca filas que ya tengan un estado asignado,
--   incluidas las suspendidas o inactivas a mano. Rollback manual al final.
-- ============================================================================


-- ── 0. ANTES DE EJECUTAR (no modifica nada) ────────────────────────────────

-- 0.a Confirmar la base:
SELECT DATABASE() AS base_actual;
--     Debe decir: jelpymx_core_assistant

-- 0.b Confirmar que el id 1 del catálogo es realmente 'Activo'.
--     Si esto NO devuelve 'Activo', DETENTE: los UPDATE de abajo pondrían
--     un status equivocado.
SELECT id, nombre, tipo FROM estados WHERE id = 1;

-- 0.c RESPALDO. Copia el resultado antes de seguir: son las filas que se van
--     a modificar y lo que necesitas para revertir.
SELECT id, nombre, correo_electronico, estado_id, registro_completo,
       eliminado, ultimo_login
  FROM suscriptores
 WHERE estado_id IS NULL
 ORDER BY id;
--     Esperado en producción: ids 11 (csalas@), 12 (apple_tester@), 13 (paty@)

-- 0.d Cuántas filas se van a tocar:
SELECT COUNT(*) AS filas_a_actualizar
  FROM suscriptores
 WHERE estado_id IS NULL
   AND eliminado = 0;


-- ── 1. ACTUALIZACIÓN ───────────────────────────────────────────────────────

START TRANSACTION;

-- Sólo cuentas vivas. Las eliminadas se dejan intactas: el borrado lógico ya
-- se marca en `eliminado` y no queremos "reactivar" una baja.
UPDATE suscriptores
   SET estado_id = 1
 WHERE estado_id IS NULL
   AND eliminado = 0;

-- Debe reportar 3 rows affected en producción.
-- Si reporta 0 y ya lo habías corrido, es correcto (idempotencia).

COMMIT;


-- ── 2. VERIFICACIÓN (no modifica nada) ─────────────────────────────────────

-- 2.a No debe quedar ninguna cuenta viva sin status (debe dar 0):
SELECT COUNT(*) AS suscriptores_activos_sin_estado
  FROM suscriptores
 WHERE estado_id IS NULL
   AND eliminado = 0;

-- 2.b Foto final de la tabla:
SELECT s.id,
       s.nombre,
       s.correo_electronico,
       s.estado_id,
       IFNULL(e.nombre, '(sin estado)') AS estado,
       s.registro_completo,
       CASE
         WHEN s.eliminado = 1                      THEN 'eliminado (no aplica)'
         WHEN s.estado_id = 1                      THEN 'OK'
         WHEN s.estado_id IS NULL                  THEN '*** SIGUE EN NULL ***'
         ELSE CONCAT('estado manual: ', IFNULL(e.nombre, s.estado_id))
       END AS resultado
  FROM suscriptores s
  LEFT JOIN estados e ON e.id = s.estado_id
 ORDER BY s.id;

-- 2.c Integridad referencial: ningún estado_id puede apuntar a un id
--     inexistente en el catálogo (debe dar 0):
SELECT COUNT(*) AS estado_id_huerfanos
  FROM suscriptores s
  LEFT JOIN estados e ON e.id = s.estado_id
 WHERE s.estado_id IS NOT NULL
   AND e.id IS NULL;


-- ── 3. ROLLBACK MANUAL (sólo si hay que revertir) ──────────────────────────
-- Devuelve a NULL exactamente las 3 filas que estaban en NULL antes.
-- Los ids están escritos a mano a propósito: un rollback genérico del tipo
-- "estado_id = NULL WHERE estado_id = 1" borraría el status de los 10
-- suscriptores que SÍ lo tenían.
--
--   START TRANSACTION;
--   UPDATE suscriptores SET estado_id = NULL WHERE id IN (11, 12, 13);
--   COMMIT;


-- ── 4. DESPUÉS DE EJECUTAR ─────────────────────────────────────────────────
-- a) Desplegar el fix de código que acompaña a esta migración; si no, cada
--    registro nuevo por OTP volverá a nacer con estado_id NULL:
--      src/common/constants/estados.constants.ts        (nuevo)
--      src/modules/auth/auth.service.ts                 (2 altas)
--      src/modules/business/suscriptores/suscriptores.service.ts
--        crear() / actualizar() / completarRegistro()
-- b) Volver a correr el bloque 2.a: debe seguir dando 0 después de que se
--    registre un usuario nuevo desde la app.
--
-- NOTA — permisos (permiso_notificaciones, permiso_geolocalizacion,
-- permiso_uso_datos): NO se tocan aquí y NO deben ponerse en 1. NULL significa
-- "nunca se le preguntó al usuario"; 1 = otorgó; 0 = negó. Pre-asignar un
-- consentimiento que el usuario no dio es inválido bajo LFPDPPP/GDPR y es
-- motivo de rechazo en App Store. Lo que falta es que la app llame a
-- PATCH /suscriptores/:id/permisos cuando el usuario responde el diálogo del
-- sistema; el backend ya tiene ese endpoint funcionando.
-- ============================================================================
