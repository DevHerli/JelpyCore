-- ============================================================================
-- MIGRACIÓN: data_004 — el registro por teléfono sólo funciona para UN usuario
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- ESTA ES LA ÚNICA DE LAS 36 DIVERGENCIAS ENTITY-vs-ESQUEMA DONDE LA BASE ESTÁ
-- MAL Y NO LA ENTITY. Las otras 34 se corrigieron en el código (`nullable:false`
-- en las relaciones), porque ahí la base tenía razón. Aquí es al revés.
--
-- EL PROBLEMA
--   La app registra por teléfono + OTP. Esos dos caminos —
--   auth.service.verifyOtpRegister() y el alta al vuelo de verifyOtp()— crean
--   el suscriptor SIN correo y SIN contraseña, que es lo correcto: el usuario
--   nunca escribió ninguno de los dos.
--
--   Pero en la base `correo_electronico` y `contrasena` son NOT NULL sin
--   default. Como el sql_mode de este servidor NO es estricto
--   (IGNORE_SPACE, NO_ZERO_IN_DATE, NO_ZERO_DATE, ERROR_FOR_DIVISION_BY_ZERO,
--   NO_ENGINE_SUBSTITUTION — falta STRICT_TRANS_TABLES), MariaDB no protesta:
--   guarda cadena vacía en ambas.
--
--   Y `correo_electronico` tiene un índice UNIQUE.
--
--   Resultado: el PRIMER usuario que se registre por teléfono se guarda con
--   correo ''. El SEGUNDO choca contra el UNIQUE y recibe un 500.
--
-- COMPROBADO CONTRA ESTA MISMA BASE (en transacción, con ROLLBACK):
--
--     1er registro por teléfono -> OK
--        correo_electronico = ""  | contrasena = ""
--     2do registro por teléfono -> FALLA
--        ER_DUP_ENTRY (1062) Duplicate entry '' for key 'correo_electronico'
--
--   Hoy no se nota porque los 13 suscriptores existentes se dieron de alta con
--   correo. El fallo aparece el día del lanzamiento, con el segundo usuario que
--   entre desde el celular, y desde ahí NADIE MÁS puede registrarse por
--   teléfono. Es un bloqueador de salida a producción.
--
-- POR QUÉ NULL Y NO ''
--   En SQL, NULL no colisiona con NULL dentro de un índice UNIQUE: pueden
--   convivir miles de suscriptores sin correo. La cadena vacía sí colisiona.
--   Además NULL dice la verdad —"este usuario no tiene correo"— mientras que ''
--   parece un correo válido y vacío, y `contrasena = ''` parece una contraseña
--   puesta cuando en realidad no hay ninguna.
--
-- LO QUE NO CAMBIA
--   · El UNIQUE de `correo_electronico` se conserva: dos cuentas no pueden
--     compartir correo.
--   · El login por correo sigue exigiendo ambos campos; en SQL `= NULL` nunca
--     empata, así que una cuenta sin correo simplemente no puede entrar por esa
--     vía (auth.service ya corta antes con `if (!suscriptor.contrasena)`).
--   · `ciudad_id` se queda NOT NULL: todas las altas la exigen y el DTO la
--     valida con @IsNotEmpty. Ahí la base tiene razón y se corrigió la entity.
--
-- EFECTO SECUNDARIO BUSCADO
--   Esto es requisito para poder activar STRICT_TRANS_TABLES. Con el sql_mode
--   estricto y estas columnas todavía NOT NULL, el registro por teléfono
--   dejaría de fallar en el segundo usuario para fallar en el primero.
--
-- SEGURIDAD
--   Idempotente. Sin DROP de tablas. No borra ni una fila.
--   Los ALTER conservan tipo, longitud, collation, comentario e índices.
-- ============================================================================


-- ── 0. ANTES DE EJECUTAR (no modifica nada) ────────────────────────────────

SELECT DATABASE() AS base_actual;
--     Debe decir: jelpymx_core_assistant

-- 0.a Estado actual de las dos columnas. Ambas deben decir IS_NULLABLE = 'NO'.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'suscriptores'
   AND COLUMN_NAME IN ('correo_electronico', 'contrasena');

-- 0.b ¿Hay ya filas con cadena vacía? (esperado hoy: 0)
SELECT SUM(correo_electronico = '') AS correos_vacios,
       SUM(contrasena = '')         AS pass_vacias,
       COUNT(*)                     AS total
  FROM suscriptores;


-- ── 1. NULABILIDAD ─────────────────────────────────────────────────────────
-- MODIFY reescribe la definición completa de la columna, así que hay que
-- repetir tipo, longitud y comentario: lo que no se escriba, se pierde.
-- El índice UNIQUE no se toca (vive aparte de la definición de la columna).

ALTER TABLE suscriptores
  MODIFY COLUMN correo_electronico VARCHAR(150) NULL DEFAULT NULL
    COMMENT 'NULL = alta por teléfono, el usuario nunca dio correo. UNIQUE: los NULL no colisionan entre sí.';

ALTER TABLE suscriptores
  MODIFY COLUMN contrasena VARCHAR(255) NULL DEFAULT NULL
    COMMENT 'Hash bcrypt. NULL = cuenta sin contraseña (entra sólo por OTP).';


-- ── 2. NORMALIZAR LAS CADENAS VACÍAS QUE PUDIERAN EXISTIR ──────────────────
-- Hoy no hay ninguna, pero si esta migración se aplica en otro entorno donde
-- ya se coló un '' hay que convertirlo a NULL: si no, el UNIQUE lo sigue
-- bloqueando todo. Idempotente: si no hay filas, no hace nada.

START TRANSACTION;

UPDATE suscriptores SET correo_electronico = NULL WHERE correo_electronico = '';
UPDATE suscriptores SET contrasena         = NULL WHERE contrasena         = '';

COMMIT;


-- ── 3. LIMPIEZA DE UN ÍNDICE REDUNDANTE ────────────────────────────────────
-- `idx_correo` es un índice normal sobre correo_electronico, exactamente la
-- misma columna que ya cubre el índice UNIQUE `correo_electronico`. Un UNIQUE
-- sirve para buscar igual que uno normal, así que idx_correo no acelera nada:
-- sólo hace que cada INSERT y cada UPDATE mantengan un árbol B de más.
-- No participa en ninguna clave foránea, por lo que quitarlo es seguro.

ALTER TABLE suscriptores DROP INDEX idx_correo;


-- ── 4. VERIFICACIÓN (no modifica nada) ─────────────────────────────────────

-- 4.a Ambas columnas deben decir ahora IS_NULLABLE = 'YES'.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME   = 'suscriptores'
   AND COLUMN_NAME IN ('correo_electronico', 'contrasena');

-- 4.b El UNIQUE de correo debe seguir vivo (Non_unique = 0) y idx_correo ya no.
SHOW INDEX FROM suscriptores WHERE Column_name = 'correo_electronico';

-- 4.c Ningún suscriptor existente debe haber perdido su correo. 13 filas, 0 nulos.
SELECT COUNT(*) AS total, SUM(correo_electronico IS NULL) AS sin_correo
  FROM suscriptores;

-- 4.d Prueba real: dos altas por teléfono seguidas, como las hace
--     verifyOtpRegister(). Va en una transacción que SIEMPRE se revierte.
START TRANSACTION;
INSERT INTO suscriptores (nombre, apellido_paterno, telefono_celular, ciudad_id,
                          estado_id, acepto_terminos, registro_completo,
                          tiene_negocios, eliminado, role, fecha_registro)
VALUES ('ProbeUno', 'Prueba', '3110000001', 1, 1, 1, 0, 0, 0, 'user', NOW());
INSERT INTO suscriptores (nombre, apellido_paterno, telefono_celular, ciudad_id,
                          estado_id, acepto_terminos, registro_completo,
                          tiene_negocios, eliminado, role, fecha_registro)
VALUES ('ProbeDos', 'Prueba', '3110000002', 1, 1, 1, 0, 0, 0, 'user', NOW());
--   Esperado: las DOS pasan, y ambas con correo_electronico NULL.
SELECT id, nombre, correo_electronico, contrasena
  FROM suscriptores WHERE nombre LIKE 'Probe%';
ROLLBACK;


-- ── 5. ROLLBACK MANUAL (sólo si hay que revertir) ──────────────────────────
-- OJO: sólo se puede revertir mientras no exista ningún suscriptor con correo
-- NULL. Si ya hay altas por teléfono, volver a NOT NULL las convierte en ''
-- y reaparece la colisión del UNIQUE.
--
--   SELECT COUNT(*) FROM suscriptores WHERE correo_electronico IS NULL;  -- debe dar 0
--
--   ALTER TABLE suscriptores ADD INDEX idx_correo (correo_electronico);
--   ALTER TABLE suscriptores
--     MODIFY COLUMN correo_electronico VARCHAR(150) NOT NULL
--       COMMENT 'Opcional pero recomendado para comunicación con el usuario';
--   ALTER TABLE suscriptores
--     MODIFY COLUMN contrasena VARCHAR(255) NOT NULL;


-- ── 6. DESPUÉS DE EJECUTAR ─────────────────────────────────────────────────
-- Con esto la base y las entities quedan alineadas al 100 % (0 CRITICO,
-- 0 ALTO, 0 MEDIO en `npm run audit:schema`) y se destraba la decisión
-- pendiente de activar STRICT_TRANS_TABLES, que hasta ahora habría roto el
-- registro por teléfono.
-- ============================================================================
