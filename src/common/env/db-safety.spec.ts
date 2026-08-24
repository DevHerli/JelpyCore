/**
 * JLP-C29 — Pruebas de la salvaguarda fail-closed contra la BD de producción.
 * No abren ninguna conexión: solo verifican la lógica pura del guard.
 */
import {
  assertTestsNeverHitProduction,
  isProductionDb,
  isUnderTest,
} from './db-safety';

describe('JLP-C29 db-safety', () => {
  const PROD_HOST = '174.136.53.220';
  const PROD_NAME = 'jelpymx_core_assistant';
  const QA_HOST = '72.249.60.198';
  const QA_NAME = 'qajelpym_databaseCore';

  describe('isProductionDb', () => {
    it('reconoce la huella de producción (host + nombre)', () => {
      expect(isProductionDb(PROD_HOST, PROD_NAME)).toBe(true);
    });

    it('ignora espacios accidentales alrededor de los valores', () => {
      expect(isProductionDb(`  ${PROD_HOST} `, ` ${PROD_NAME}  `)).toBe(true);
    });

    it('la BD de QA NO es producción', () => {
      expect(isProductionDb(QA_HOST, QA_NAME)).toBe(false);
    });

    it('un host de prod con OTRO nombre de BD no es la huella de prod', () => {
      expect(isProductionDb(PROD_HOST, 'otra_db')).toBe(false);
    });

    it('valores vacíos/undefined no son producción', () => {
      expect(isProductionDb(undefined, undefined)).toBe(false);
      expect(isProductionDb('', '')).toBe(false);
    });
  });

  describe('isUnderTest', () => {
    it('detecta jest por JEST_WORKER_ID (siempre presente en este runner)', () => {
      expect(isUnderTest()).toBe(true);
    });
  });

  describe('assertTestsNeverHitProduction', () => {
    it('ABORTA si un proceso de pruebas apunta a producción', () => {
      expect(() =>
        assertTestsNeverHitProduction(PROD_HOST, PROD_NAME),
      ).toThrow(/JLP-C29/);
    });

    it('PERMITE la BD de QA aislada durante los tests', () => {
      expect(() =>
        assertTestsNeverHitProduction(QA_HOST, QA_NAME),
      ).not.toThrow();
    });
  });
});
