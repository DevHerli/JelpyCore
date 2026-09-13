import { SocialQueryNormalizer } from './social-query-normalizer';

describe('SocialQueryNormalizer', () => {
  it('traduce planes de pareja a una búsqueda de restaurantes/cena', () => {
    const result = SocialQueryNormalizer.normalize('recomiéndame lugares para llevar a mi novia a cenar');

    expect(result.detectedPlan).toBe('date_night');
    expect(result.text).toMatch(/restaurantes|cena/i);
  });

  it('traduce pistear con compas a bares/cantinas', () => {
    const result = SocialQueryNormalizer.normalize('donde pistear con mis compas');

    expect(result.detectedPlan).toBe('drinks');
    expect(result.text).toMatch(/bares|antros|cantinas|cerveza/i);
  });

  it('traduce "lugar de pistear" a bares/antros y no busca literalmente lugar', () => {
    const result = SocialQueryNormalizer.normalize('dime lugar de pistear');

    expect(result.detectedPlan).toBe('drinks');
    expect(result.text).toMatch(/bares|antros|cantinas|cerveza/i);
    expect(result.text).not.toMatch(/\blugar\b/i);
  });

  it('traduce chelitas baratas a caguamerías/licorerías', () => {
    const result = SocialQueryNormalizer.normalize('quiero chelitas baratas');

    expect(result.detectedPlan).toBe('drinks');
    expect(result.text).toMatch(/caguamerias|licorerias|cerveza/i);
  });

  it('traduce "dónde están las chelitas más baras" a chelas/caguamas baratas', () => {
    const result = SocialQueryNormalizer.normalize('dime donde estan las chelitas mas baras');

    expect(result.detectedPlan).toBe('drinks');
    expect(result.text).toMatch(/caguamerias|licorerias|cerveza barata|promociones/i);
    expect(result.text).not.toMatch(/\bestan\b|\bdonde\b/i);
  });

  it('entiende slang de drinks como kiwas, caguamitas y echar drinks', () => {
    for (const texto of ['kiwas baratas', 'caguamitas baratas', 'echar drinks']) {
      const result = SocialQueryNormalizer.normalize(texto);

      expect(result.detectedPlan).toBe('drinks');
      expect(result.text).toMatch(/cerveza|caguamas|bares|cantinas|promociones/i);
    }
  });

  it('traduce taquitos buenos a taquerías', () => {
    const result = SocialQueryNormalizer.normalize('taquitos buenos');

    expect(result.detectedPlan).toBe('tacos');
    expect(result.text).toMatch(/tacos|taquerias/i);
  });
});
