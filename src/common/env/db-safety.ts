/**
 * JLP-C29 — Salvaguarda fail-fast: los tests NUNCA deben tocar la BD de producción.
 * ------------------------------------------------------------------------------
 * Contexto del hallazgo:
 *   El archivo `.env` cargado por defecto estaba etiquetado `NODE_ENV=qa` pero
 *   apuntaba a la BD REAL de producción (174.136.53.220 / jelpymx_core_assistant).
 *   Como el harness de tests (jest) levanta `AppModule`, que abre una conexión
 *   TypeORM con las credenciales de `.env`, cualquier ejecución de e2e se
 *   conectaba a producción sin que nadie lo notara.
 *
 * Estrategia (fail-closed):
 *   - Se define la huella conocida de la(s) BD de producción.
 *   - Si el proceso es de pruebas (jest fija JEST_WORKER_ID en cada worker, o
 *     NODE_ENV=test) y las credenciales resueltas coinciden con producción,
 *     se ABORTA el arranque con un error claro. Nunca se llega a abrir la
 *     conexión.
 *   - En producción real (sin jest, NODE_ENV != test) la función es un no-op:
 *     no cambia ningún comportamiento existente.
 *
 * Esto es una defensa en profundidad: aunque alguien ejecute `jest` a mano sin
 * NODE_ENV=test (y por tanto cargue `.env` de prod), JEST_WORKER_ID sigue
 * presente y el guard aborta. Es preferible fallar el arranque a conectar a prod.
 */

/** Huellas (host + nombre de BD) que identifican bases de datos de PRODUCCIÓN. */
const PROD_DB_FINGERPRINTS: ReadonlyArray<{ host: string; name: string }> = [
  { host: '174.136.53.220', name: 'jelpymx_core_assistant' },
];

/** ¿El (host, name) dado corresponde a una BD de producción conocida? */
export function isProductionDb(host?: string, name?: string): boolean {
  const h = (host ?? '').trim();
  const n = (name ?? '').trim();
  return PROD_DB_FINGERPRINTS.some((fp) => fp.host === h && fp.name === n);
}

/** ¿El proceso actual es una ejecución de pruebas (jest)? */
export function isUnderTest(): boolean {
  return (
    !!process.env.JEST_WORKER_ID ||
    (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'test'
  );
}

/**
 * Aborta el arranque si un proceso de pruebas está a punto de conectarse a la
 * BD de producción. No-op en cualquier otro contexto.
 */
export function assertTestsNeverHitProduction(host?: string, name?: string): void {
  if (isUnderTest() && isProductionDb(host, name)) {
    throw new Error(
      '\n\n🛑 JLP-C29 — ARRANQUE ABORTADO.\n' +
        `Un proceso de PRUEBAS (jest) intentó conectarse a la BASE DE DATOS DE PRODUCCIÓN (${host}/${name}).\n` +
        'Los tests solo pueden correr contra la BD de QA aislada.\n' +
        'Usa NODE_ENV=test (los scripts npm ya lo fijan) para cargar `.env.qa`,\n' +
        'que apunta a la BD de QA. Revisa tu configuración de entorno.\n',
    );
  }
}
