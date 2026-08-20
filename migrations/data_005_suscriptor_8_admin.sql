-- ============================================================================
-- MIGRACIÓN: data_005 — el suscriptor 8 (Administrador Jelpy) queda como admin
-- BASE DE DATOS DESTINO: jelpymx_core_assistant  (PRODUCCIÓN)
-- ============================================================================
--
-- EL PROBLEMA
--   En producción NO EXISTE NINGÚN ADMINISTRADOR. Los 13 suscriptores tienen
--   role = 'user':
--
--       SELECT role, COUNT(*) FROM suscriptores WHERE eliminado=0 GROUP BY role;
--       -> user | 13
--
--   El suscriptor 8 se llama literalmente "Administrador Jelpy"
--   (admin@jelpy.mx), es el dueño de los 18 negocios dados de alta hasta hoy y
--   es la cuenta desde la que se opera el back-office. Pero su role quedó en
--   'user', que es el DEFAULT de la columna. Nunca se le asignó.
--
-- QUÉ ESTÁ ROTO HOY POR ESTO
--   `AdminGuard` (src/common/guards/admin.guard.ts) exige role='admin' leído de
--   la BD, no del claim del token. Como nadie lo tiene, TODA ruta protegida con
--   AdminGuard responde 403 a cualquier persona. Entre otras:
--
--     · POST/PUT/DELETE /membresias            (precios y planes)
--     · escritura de los 12 catálogos maestros (ciudades, estados, categorías,
--       subcategorías, especialidades, códigos postales, colonias, calles,
--       keywords, características de sucursal, aliases, publicidad-chat)
--     · moderación de reseñas y /reportes-moderacion
--     · BI de plataforma (resumen, totales por ciudad, top, semanales)
--     · inyección de históricos de estadísticas
--
--   Y además todos los atajos de propiedad `if (requester.isAdmin) return;`
--   —unas 30 comprobaciones repartidas por los servicios— nunca se activan, así
--   que el back-office no puede operar sobre negocios de terceros.
--
-- QUÉ CAMBIA
--   Una sola columna, una sola fila. `role` es un ENUM('user','admin','editor')
--   NOT NULL DEFAULT 'user'; 'admin' es un valor ya válido, no hay DDL.
--
-- ALCANCE REAL DEL PRIVILEGIO (para que quede escrito)
--   role='admin' es el interruptor ÚNICO de super admin en este backend. No hay
--   tabla de roles ni de permisos (se verificó: no existe ninguna tabla con
--   'rol', 'permis' o 'admin' en el nombre). Con él, la cuenta 8:
--     · pasa AdminGuard en todas las rutas de arriba;
--     · omite TODA verificación de propiedad (negocios, sucursales, anuncios,
--       promociones, horarios, productos, reseñas, facturas, pagos, soporte,
--       estadísticas y sesiones de IA);
--     · puede crear negocios a nombre de CUALQUIER suscriptor, porque
--       `POST /negocios` sólo respeta el `suscriptorId` del body si el
--       solicitante es admin (negocios.controller.ts).
--   Esa última capacidad es justo la que se necesita para dar de alta negocios
--   por cortesía a nombre de los clientes.
--
--   El valor 'editor' del ENUM no lo lee ningún guard ni ninguna comprobación
--   (se buscó en todo src/): hoy es equivalente a 'user'. No usarlo esperando
--   permisos intermedios.
--
-- LO QUE NO HACE FALTA TOCAR — LA MEMBRESÍA YA ESTÁ BIEN
--   Se verificó contra producción antes de escribir esto:
--     · suscriptores.membresia_id = 2 -> 'Cortesia', precio 0.00
--     · suscriptor_suscripciones id=1: suscriptor 8, membresía 2, 'activa',
--       fecha_inicio 2026-02-28, fecha_fin NULL (no vence)
--   No se modifica nada de la membresía: ya es Cortesía y ya está activa.
--
--   Nota aparte: hoy NADA en el código limita cuántos negocios puede crear un
--   suscriptor. La constante LIMITE_NEGOCIOS_POR_MEMBRESIA
--   (src/common/constants/negocios.constants.ts) está declarada pero no se
--   importa en ningún lado — es código muerto. Por eso el suscriptor 8 ya tiene
--   18 negocios con un plan cuyo límite nominal sería otro. Es decir: la
--   Cortesía no es lo que hoy le permite dar de alta negocios; simplemente no
--   hay tope para nadie. Queda registrado como deuda a decidir aparte.
--
-- SEGURIDAD
--   Idempotente. Toca una fila. Reversible (§4). Sin DROP, sin borrado.
-- ============================================================================


-- ── 0. ANTES DE EJECUTAR (no modifica nada) ────────────────────────────────

SELECT DATABASE() AS base_actual;   -- debe decir: jelpymx_core_assistant

-- 0.a Confirmar que efectivamente no hay ningún admin.
SELECT role, COUNT(*) AS n
  FROM suscriptores WHERE eliminado = 0 GROUP BY role;

-- 0.b Confirmar que el 8 es quien creemos y que su membresía ya es Cortesía.
SELECT s.id, s.nombre, s.apellido_paterno, s.correo_electronico, s.role,
       s.membresia_id, m.nombre AS membresia, m.precio
  FROM suscriptores s
  LEFT JOIN membresias m ON m.id = s.membresia_id
 WHERE s.id = 8;


-- ── 1. EL CAMBIO ───────────────────────────────────────────────────────────
-- Acotado por id Y por correo: si por lo que sea el id 8 no fuera esa cuenta,
-- el UPDATE afecta 0 filas en vez de promover a un desconocido a super admin.

UPDATE suscriptores
   SET role = 'admin',
       fecha_actualizacion = NOW()
 WHERE id = 8
   AND correo_electronico = 'admin@jelpy.mx'
   AND eliminado = 0;
--   Esperado: 1 fila afectada.


-- ── 2. VERIFICACIÓN (no modifica nada) ─────────────────────────────────────

-- 2.a El 8 debe decir 'admin' y seguir en Cortesía.
SELECT s.id, s.nombre, s.correo_electronico, s.role,
       m.nombre AS membresia, m.precio
  FROM suscriptores s
  LEFT JOIN membresias m ON m.id = s.membresia_id
 WHERE s.id = 8;

-- 2.b Debe haber EXACTAMENTE un admin. Si sale más de uno, revisar de inmediato.
SELECT id, nombre, correo_electronico, role
  FROM suscriptores WHERE role = 'admin' AND eliminado = 0;

-- 2.c Su suscripción de Cortesía sigue intacta y única.
SELECT id, suscriptor_id, membresia_id, estatus, fecha_inicio, fecha_fin
  FROM suscriptor_suscripciones WHERE suscriptor_id = 8;


-- ── 3. CÓMO DAR DE ALTA UN NEGOCIO POR CORTESÍA ────────────────────────────
-- No es un cambio de esquema, es la forma de usarlo. Ya autenticado como el
-- suscriptor 8, `POST /negocios` acepta el `suscriptorId` del cliente final
-- (sólo lo acepta si quien llama es admin) y el estado de cortesía es el 16:
--
--     SELECT id, nombre FROM estados WHERE id = 16;   -- 'Cortesía'
--
-- Es decir: estadoId = 16 en el alta, y suscriptorId = el del cliente al que se
-- le regala el negocio. Si se deja el suscriptorId del propio 8, el negocio
-- queda a nombre de la cuenta administradora (que es como están los 18 de hoy).


-- ── 4. ROLLBACK MANUAL (sólo si hay que revertir) ──────────────────────────
--
--   UPDATE suscriptores SET role = 'user', fecha_actualizacion = NOW()
--    WHERE id = 8 AND correo_electronico = 'admin@jelpy.mx';
--
-- Efecto inmediato, sin esperar a que expire el token: JwtAuthGuard relee el
-- role de la BD en cada request (JLP-M06), así que la degradación aplica al
-- siguiente llamado.
-- ============================================================================
