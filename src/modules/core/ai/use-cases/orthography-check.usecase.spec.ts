import { OrthographyCheckUseCase } from './orthography-check.usecase';

/**
 * JLP-ORTOGRAFIA-SUCHI-FIX: el usuario reportó que "promo suchi" producía
 * un error genérico ("Tuve un problema para procesar tu mensaje...") y
 * sospechó específicamente que la corrección ortográfica de "suchi" →
 * "sushi" no estaba funcionando. Se investigó a fondo (incluyendo pruebas
 * de punta a punta contra la BD y el microservicio de FastAPI reales) y no
 * se logró reproducir ningún error para ese mensaje — la causa raíz más
 * plausible resultó ser la falta de blindaje ante errores transitorios de
 * BD al guardar turnos de conversación (ver JLP-TURNO-BLINDADO-FIX en
 * `ConversationService`), no la ortografía.
 *
 * Esta suite deja fijado, con pruebas, que la corrección ortográfica SÍ
 * funciona correctamente para "suchi"/variantes de "sushi" y para las
 * palabras de promociones, para que quede documentado y no se repita la
 * duda en el futuro.
 */
describe('OrthographyCheckUseCase', () => {
  const useCase = new OrthographyCheckUseCase();

  it('corrige "suchi" (typo común) a "sushi"', () => {
    expect(useCase.execute('promo suchi')).toBe('promoción sushi');
  });

  it('corrige "susi" a "sushi" también', () => {
    expect(useCase.execute('quiero susi')).toBe('quiero sushi');
  });

  it('no altera "sushi" cuando ya está bien escrito', () => {
    expect(useCase.execute('quiero sushi')).toBe('quiero sushi');
  });

  it('normaliza "promo"/"promos" a "promoción"/"promociones"', () => {
    expect(useCase.execute('promo')).toBe('promoción');
    expect(useCase.execute('promos de tacos')).toBe('promociones de tacos');
  });

  it('combina corrección fonética + normalización de intención en un solo mensaje', () => {
    expect(useCase.execute('promo suchi porfa')).toBe(
      'promoción sushi por favor',
    );
  });

  it('no rompe con texto vacío o undefined', () => {
    expect(useCase.execute('')).toBe('');
    expect(useCase.execute(undefined as any)).toBe(undefined);
  });
});
