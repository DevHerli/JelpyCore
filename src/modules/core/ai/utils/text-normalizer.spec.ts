import { TextNormalizer } from './text-normalizer';

/**
 * Suite dedicada a la tolerancia de ortografía (pedida explícitamente por
 * el usuario tras el bug real de "Kien erez"): muchas personas en México
 * escriben rápido, sin acentos y confundiendo letras que suenan igual
 * (seseo, yeísmo, betacismo, h muda). Esta clase es la pieza central que
 * hace que Jelpy entienda esos mensajes — se prueba aislada del resto del
 * pipeline conversacional para que cualquier regresión aquí se detecte de
 * inmediato, sin depender de qué intención dispare cada frase.
 */
describe('TextNormalizer.clavefonetica', () => {
  it('nunca lanza excepción con entradas vacías, nulas o solo espacios', () => {
    expect(() => TextNormalizer.clavefonetica('')).not.toThrow();
    expect(() => TextNormalizer.clavefonetica('   ')).not.toThrow();
    expect(() => TextNormalizer.clavefonetica(undefined as unknown as string)).not.toThrow();
  });

  const paresEquivalentes: Array<[string, string]> = [
    // seseo (s/z/c)
    ['erez', 'eres'],
    ['grasias', 'gracias'],
    ['sielo', 'cielo'],
    // yeísmo (ll/y)
    ['yamas', 'llamas'],
    // betacismo (b/v)
    ['aber', 'haber'],
    // qu/k
    ['kien', 'quien'],
    ['komo', 'como'],
    // h muda (se agrega o se omite)
    ['ola', 'hola'],
    ['aora', 'ahora'],
    // letras repetidas por error de tecleo
    ['polllo', 'pollo'],
  ];

  it.each(paresEquivalentes)(
    '"%s" y "%s" producen la misma clave fonética',
    (conFalta, correcto) => {
      expect(TextNormalizer.clavefonetica(conFalta)).toBe(TextNormalizer.clavefonetica(correcto));
    },
  );

  it('el dígrafo "ch" no se trata como una "h muda" (no colapsa a "c")', () => {
    expect(TextNormalizer.clavefonetica('chico')).toContain('ch');
    expect(TextNormalizer.clavefonetica('chico')).not.toBe(TextNormalizer.clavefonetica('sico'));
  });

  it('sigue distinguiendo palabras genuinamente distintas (no colapsa todo a lo mismo)', () => {
    expect(TextNormalizer.clavefonetica('hola')).not.toBe(TextNormalizer.clavefonetica('adios'));
    expect(TextNormalizer.clavefonetica('gracias')).not.toBe(TextNormalizer.clavefonetica('quiero'));
  });

  it('preserva los espacios entre palabras (no colapsa una frase en una sola palabra)', () => {
    expect(TextNormalizer.clavefonetica('kien erez')).toBe('kien eres');
  });
});
