import { TextNormalizer } from './text-normalizer';

export interface SocialQueryNormalization {
  text: string;
  detectedPlan?:
    | 'date_night'
    | 'food'
    | 'drinks'
    | 'tacos'
    | 'tires'
    | 'mechanic'
    | 'plumber'
    | 'hardware'
    | 'sports'
    | 'fitness'
    | 'pool'
    | 'dairy';
  userFacingHint?: string;
}

export class SocialQueryNormalizer {
  private static has(t: string, phrase: string): boolean {
    return t.includes(TextNormalizer.clavefonetica(phrase));
  }

  static normalize(text: string): SocialQueryNormalization {
    const t = TextNormalizer.clavefonetica(text);

    if (
      this.has(t, 'me ponche') ||
      this.has(t, 'me ponché') ||
      this.has(t, 'se me poncho') ||
      this.has(t, 'se me ponchó') ||
      this.has(t, 'traigo una llanta ponchada') ||
      this.has(t, 'llanta ponchada') ||
      this.has(t, 'ponchadura') ||
      this.has(t, 'parchar llanta') ||
      this.has(t, 'reparar llanta')
    ) {
      return {
        text: 'llanteras llantero ponchadura parchar llanta auxilio de llantas',
        detectedPlan: 'tires',
        userFacingHint: 'Busqué llanteras y ayuda para llantas ponchadas.',
      };
    }

    if (
      this.has(t, 'mi coche se descompuso') ||
      this.has(t, 'mi carro se descompuso') ||
      this.has(t, 'mi auto se descompuso') ||
      this.has(t, 'mi carcacha se descompuso') ||
      this.has(t, 'mi carchaca se descompuso') ||
      this.has(t, 'carro fallando') ||
      this.has(t, 'auto fallando') ||
      this.has(t, 'coche fallando') ||
      this.has(t, 'se descompuso mi carro') ||
      this.has(t, 'se descompuso mi coche') ||
      this.has(t, 'se descompuso mi auto') ||
      this.has(t, 'no prende mi carro') ||
      this.has(t, 'no arranca mi carro')
    ) {
      return {
        text: 'mecanicos taller mecanico mecanico automotriz carro descompuesto',
        detectedPlan: 'mechanic',
        userFacingHint: 'Busqué mecánicos y talleres para revisar tu auto.',
      };
    }

    if (
      this.has(t, 'reparar tuberia') ||
      this.has(t, 'reparar tubería') ||
      this.has(t, 'reparar tuberias') ||
      this.has(t, 'reparar tuberías') ||
      this.has(t, 'se rompio una tuberia') ||
      this.has(t, 'se rompió una tubería') ||
      this.has(t, 'fuga de agua') ||
      this.has(t, 'tubo roto') ||
      this.has(t, 'drenaje tapado') ||
      this.has(t, 'baño tapado') ||
      this.has(t, 'necesito plomero')
    ) {
      return {
        text: 'plomeros plomeria reparar tuberia fuga de agua destapar drenaje',
        detectedPlan: 'plumber',
        userFacingHint: 'Busqué plomeros para fugas, tuberías o drenajes.',
      };
    }

    if (
      this.has(t, 'cancha de padel') ||
      this.has(t, 'canchas de padel') ||
      this.has(t, 'cancha de pádel') ||
      this.has(t, 'canchas de pádel') ||
      this.has(t, 'jugar padel') ||
      this.has(t, 'jugar pádel') ||
      this.has(t, 'rentar cancha') ||
      this.has(t, 'renta de cancha')
    ) {
      return {
        text: 'canchas de padel club deportivo renta de cancha',
        detectedPlan: 'sports',
        userFacingHint: 'Busqué canchas y clubes deportivos.',
      };
    }

    if (
      this.has(t, 'alberca') ||
      this.has(t, 'albercas') ||
      this.has(t, 'piscina') ||
      this.has(t, 'piscinas') ||
      this.has(t, 'clases de natacion') ||
      this.has(t, 'clases de natación') ||
      this.has(t, 'nadar')
    ) {
      return {
        text: 'albercas piscinas natacion clases de natacion',
        detectedPlan: 'pool',
        userFacingHint: 'Busqué albercas, piscinas o lugares para nadar.',
      };
    }

    if (
      this.has(t, 'gym') ||
      this.has(t, 'gimnasio') ||
      this.has(t, 'gyms') ||
      this.has(t, 'hacer ejercicio') ||
      this.has(t, 'entrenar') ||
      this.has(t, 'pesas')
    ) {
      return {
        text: 'gimnasios gym fitness pesas entrenamiento',
        detectedPlan: 'fitness',
        userFacingHint: 'Busqué gimnasios y lugares para entrenar.',
      };
    }

    if (
      this.has(t, 'cremeria') ||
      this.has(t, 'cremería') ||
      this.has(t, 'quesos') ||
      this.has(t, 'jamon') ||
      this.has(t, 'jamón') ||
      this.has(t, 'lacteos') ||
      this.has(t, 'lácteos')
    ) {
      return {
        text: 'cremerias quesos lacteos jamon embutidos',
        detectedPlan: 'dairy',
        userFacingHint: 'Busqué cremerías, quesos y lácteos.',
      };
    }

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
      this.has(t, 'lugar de pistear') ||
      this.has(t, 'lugares para pistear') ||
      this.has(t, 'lugar para pistear') ||
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
      this.has(t, 'ir por chelas') ||
      this.has(t, 'echar drinks') ||
      this.has(t, 'beber alcohol') ||
      this.has(t, 'tomar alcohol') ||
      this.has(t, 'tomar unas chelas') ||
      this.has(t, 'unas chelitas') ||
      this.has(t, 'kiwas') ||
      this.has(t, 'kiwis') ||
      this.has(t, 'kikis') ||
      this.has(t, 'kiwasakis') ||
      this.has(t, 'caguamitas') ||
      this.has(t, 'kaguamitas') ||
      this.has(t, 'amargosas')
    ) {
      return {
        text: 'bares antros cantinas restaurantes con cerveza micheladas para tomar con amigos',
        detectedPlan: 'drinks',
        userFacingHint: 'Busqué bares, antros y lugares para tomar algo.',
      };
    }

    if (
      this.has(t, 'chelitas') ||
      this.has(t, 'chelas baratas') ||
      this.has(t, 'chelitas baratas') ||
      this.has(t, 'chelitas mas baratas') ||
      this.has(t, 'chelitas más baratas') ||
      this.has(t, 'chelitas mas baras') ||
      this.has(t, 'chelitas más baras') ||
      this.has(t, 'donde estan las chelitas') ||
      this.has(t, 'donde están las chelitas') ||
      this.has(t, 'cheve barata') ||
      this.has(t, 'cerveza barata') ||
      this.has(t, 'cerveza bara') ||
      this.has(t, 'cervezas baratas') ||
      this.has(t, 'caguamas baratas') ||
      this.has(t, 'caguamitas baratas') ||
      this.has(t, 'kaguamitas baratas') ||
      this.has(t, 'kiwas baratas') ||
      this.has(t, 'kiwis baratas') ||
      this.has(t, 'kikis baratas') ||
      this.has(t, 'kiwasakis baratas') ||
      this.has(t, 'chelas frias') ||
      this.has(t, 'chelas frías') ||
      this.has(t, 'cheve fria') ||
      this.has(t, 'cheve fría') ||
      this.has(t, 'cerveza fria') ||
      this.has(t, 'cerveza fría') ||
      this.has(t, 'caguamas frias') ||
      this.has(t, 'caguamas frías') ||
      this.has(t, 'amargosas')
    ) {
      return {
        text: 'caguamerias licorerias bares cantinas cerveza barata chelas caguamas promociones',
        detectedPlan: 'drinks',
        userFacingHint: 'Busqué opciones para chelas, caguamas o promociones de bebidas.',
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
