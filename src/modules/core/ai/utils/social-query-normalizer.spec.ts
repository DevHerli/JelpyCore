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
    expect(result.text).toMatch(/bares|cantinas|cerveza/i);
  });

  it('traduce chelitas baratas a caguamerías/licorerías', () => {
    const result = SocialQueryNormalizer.normalize('quiero chelitas baratas');

    expect(result.detectedPlan).toBe('drinks');
    expect(result.text).toMatch(/caguamerias|licorerias|cerveza/i);
  });

  it('traduce taquitos buenos a taquerías', () => {
    const result = SocialQueryNormalizer.normalize('taquitos buenos');

    expect(result.detectedPlan).toBe('tacos');
    expect(result.text).toMatch(/tacos|taquerias/i);
  });
});
