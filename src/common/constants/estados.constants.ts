/**
 * IDs del catálogo `estados` que aplican a un suscriptor.
 *
 * `estados` NO es un catálogo geográfico: es un catálogo de status, segmentado
 * por la columna `tipo` ('general', 'suscriptor', 'negocio', 'membresia', ...).
 * Los valores de aquí abajo están verificados contra la BD de producción
 * (jelpymx_core_assistant):
 *
 *   id 1 → 'Activo'      (tipo general)
 *   id 2 → 'Inactivo'    (tipo general)
 *   id 3 → 'Eliminado'   (tipo general)
 *   id 4 → 'Pendiente'   (tipo general)
 *   id 5 → 'Suspendido'  (tipo general)
 *
 * Se centralizan aquí porque el alta de suscriptores ocurre en DOS servicios
 * distintos —`SuscriptoresService.crear()` y `AuthService.verifyOtpRegister()`—
 * y ninguno de los dos asignaba estado. El registro por OTP (el de la app) es
 * el que dejó a los suscriptores 11, 12 y 13 con `estado_id` en NULL.
 *
 * Los estados de negocio/membresía viven en `negocios.constants.ts`.
 */
export const ESTADOS_SUSCRIPTOR = {
  ACTIVO: 1,
  INACTIVO: 2,
  ELIMINADO: 3,
  PENDIENTE: 4,
  SUSPENDIDO: 5,
} as const;
