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

  it('entiende slang de drinks como kiwas, kikis, kiwis, caguamitas y echar drinks', () => {
    for (const texto of ['kiwas baratas', 'kikis baratas', 'kiwis baratas', 'kaguamitas baratas', 'caguamitas baratas', 'amargosas', 'chelas frias', 'echar drinks']) {
      const result = SocialQueryNormalizer.normalize(texto);

      expect(result.detectedPlan).toBe('drinks');
      expect(result.text).toMatch(/cerveza|caguamas|bares|cantinas|promociones/i);
    }
  });

  it('"carnes frías" no se confunde con chelas frías ni cerveza', () => {
    const result = SocialQueryNormalizer.normalize('donde venden carnes frias');

    expect(result.detectedPlan).toBeUndefined();
    expect(result.text).toBe('donde venden carnes frias');
    expect(result.text).not.toMatch(/cerveza|caguamas|bares|cantinas|promociones/i);
  });

  it('traduce taquitos buenos a taquerías', () => {
    const result = SocialQueryNormalizer.normalize('taquitos buenos');

    expect(result.detectedPlan).toBe('tacos');
    expect(result.text).toMatch(/tacos|taquerias/i);
  });

  it('traduce "me ponché" a llanteras', () => {
    const result = SocialQueryNormalizer.normalize('me ponche que hago');

    expect(result.detectedPlan).toBe('tires');
    expect(result.text).toMatch(/llanteras|ponchadura|llanta/i);
  });

  it('traduce auto descompuesto a mecánicos', () => {
    const result = SocialQueryNormalizer.normalize('mi carchaca se descompuso');

    expect(result.detectedPlan).toBe('mechanic');
    expect(result.text).toMatch(/mecanicos|taller mecanico|automotriz/i);
  });

  it('traduce problemas de tubería a plomeros', () => {
    const result = SocialQueryNormalizer.normalize('necesito reparar tuberias');

    expect(result.detectedPlan).toBe('plumber');
    expect(result.text).toMatch(/plomeros|plomeria|tuberia/i);
  });

  it('traduce canchas de pádel, albercas, gyms y cremerías a giros buscables', () => {
    expect(SocialQueryNormalizer.normalize('canchas de padel').text).toMatch(/padel|cancha/i);
    expect(SocialQueryNormalizer.normalize('albercas para nadar').text).toMatch(/albercas|natacion/i);
    expect(SocialQueryNormalizer.normalize('gyms cerca').text).toMatch(/gimnasios|fitness/i);
    expect(SocialQueryNormalizer.normalize('cremerias').text).toMatch(/cremerias|quesos|lacteos/i);
  });
});
