import { TextNormalizer } from './text-normalizer';

export interface SocialQueryNormalization {
  text: string;
  detectedPlan?: 'date_night' | 'food' | 'drinks' | 'tacos';
  userFacingHint?: string;
}

export class SocialQueryNormalizer {
  private static has(t: string, phrase: string): boolean {
    return t.includes(TextNormalizer.clavefonetica(phrase));
  }

  static normalize(text: string): SocialQueryNormalization {
    const t = TextNormalizer.clavefonetica(text);

    const mencionaPareja =
      this.has(t, 'novia') ||
      this.has(t, 'novio') ||
      this.has(t, 'pareja') ||
      this.has(t, 'cita') ||
      this.has(t, 'date') ||
      this.has(t, 'romantico') ||
      this.has(t, 'romántico');

    const mencionaComida =
      this.has(t, 'cenar') ||
      this.has(t, 'cena') ||
      this.has(t, 'comer') ||
      this.has(t, 'restaurante') ||
      this.has(t, 'llevar a');

    if (mencionaPareja && mencionaComida) {
      return {
        text: 'restaurantes para cenar en pareja cena romantica comida',
        detectedPlan: 'date_night',
        userFacingHint: 'Busqué opciones para una salida en pareja.',
      };
    }

    if (
      this.has(t, 'pistear') ||
      this.has(t, 'pistear con mis compas') ||
      this.has(t, 'salir de peda') ||
      this.has(t, 'ir de peda') ||
      this.has(t, 'una peda') ||
      this.has(t, 'antro con amigos') ||
      this.has(t, 'antros con amigos') ||
      this.has(t, 'botanear') ||
      this.has(t, 'tomar con mis amigos') ||
      this.has(t, 'tomar con compas') ||
      this.has(t, 'ir por cheves') ||
      this.has(t, 'ir por chelas')
    ) {
      return {
        text: 'bares cantinas cerveza micheladas para tomar con amigos',
        detectedPlan: 'drinks',
        userFacingHint: 'Busqué bares y lugares para tomar algo con amigos.',
      };
    }

    if (
      this.has(t, 'chelitas') ||
      this.has(t, 'chelas baratas') ||
      this.has(t, 'cheve barata') ||
      this.has(t, 'cerveza barata') ||
      this.has(t, 'caguamas baratas')
    ) {
      return {
        text: 'caguamerias licorerias cerveza barata chelas caguamas',
        detectedPlan: 'drinks',
        userFacingHint: 'Busqué opciones para chelas o caguamas.',
      };
    }

    if (
      this.has(t, 'taquitos') ||
      this.has(t, 'taquitos buenos') ||
      this.has(t, 'tacos buenos') ||
      this.has(t, 'buenos tacos')
    ) {
      return {
        text: 'tacos taquerias tacos buenos',
        detectedPlan: 'tacos',
        userFacingHint: 'Busqué taquerías y tacos.',
      };
    }

    if (
      this.has(t, 'algo para comer') ||
      this.has(t, 'donde comer') ||
      this.has(t, 'que comer') ||
      this.has(t, 'recomiendame comida') ||
      this.has(t, 'comida barata') ||
      this.has(t, 'comida para llevar') ||
      this.has(t, 'el bajon') ||
      this.has(t, 'bajon') ||
      this.has(t, 'bajón')
    ) {
      return {
        text: 'restaurantes comida donde comer',
        detectedPlan: 'food',
        userFacingHint: 'Busqué lugares para comer.',
      };
    }

    return { text };
  }
}
