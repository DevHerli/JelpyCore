import { TextNormalizer } from './text-normalizer';

export type JelpySafetyCategory =
  | 'sexual_content'
  | 'drugs'
  | 'human_violence'
  | 'animal_violence'
  | 'private_data'
  | 'internal_security';

export interface JelpySafetyResult {
  blocked: boolean;
  category?: JelpySafetyCategory;
  title?: string;
  message?: string;
}

export class SafetyPolicy {
  private static has(t: string, phrase: string): boolean {
    return t.includes(TextNormalizer.clavefonetica(phrase));
  }

  static check(text: string): JelpySafetyResult {
    const t = TextNormalizer.clavefonetica(text);

    if (!t) return { blocked: false };

    if (this.isPrivateDataRequest(t)) {
      return this.response(
        'private_data',
        'No puedo compartir información privada',
        'No puedo revelar datos personales de usuarios, empleados, dueños o negocios fuera de la información pública disponible en Jelpy. Sí puedo ayudarte a encontrar negocios, servicios o información pública dentro de la app.',
      );
    }

    if (this.isInternalSecurityRequest(t)) {
      return this.response(
        'internal_security',
        'No puedo compartir información interna de Jelpy',
        'No puedo dar accesos, contraseñas, tokens, claves, detalles internos de seguridad, bases de datos o información privada del equipo de Jelpy. Puedo ayudarte con dudas generales de uso o con búsquedas de negocios.',
      );
    }

    if (this.isSexualContentRequest(t)) {
      return this.response(
        'sexual_content',
        'No puedo ayudar con contenido sexual explícito',
        'No puedo buscar pornografía, servicios sexuales o contenido sexual explícito. Si quieres, puedo ayudarte a encontrar planes, restaurantes, hoteles, salud, bienestar o entretenimiento permitido.',
      );
    }

    if (this.isDrugRequest(t)) {
      return this.response(
        'drugs',
        'No puedo ayudar con drogas ilegales',
        'No puedo ayudar a comprar, vender, conseguir o consumir drogas ilegales. Sí puedo ayudarte a encontrar farmacias, clínicas, apoyo de salud o servicios permitidos.',
      );
    }

    if (this.isAnimalViolenceRequest(t)) {
      return this.response(
        'animal_violence',
        'No puedo ayudar con violencia contra animales',
        'No puedo ayudar a lastimar animales ni dar instrucciones para hacerlo. Si se trata de una emergencia con una mascota, puedo ayudarte a buscar veterinarias o servicios de rescate.',
      );
    }

    if (this.isHumanViolenceRequest(t)) {
      return this.response(
        'human_violence',
        'No puedo ayudar con violencia',
        'No puedo ayudar a lastimar, amenazar o atacar a una persona. Si hay una emergencia o riesgo inmediato, contacta a servicios de emergencia. También puedo ayudarte a buscar apoyo médico, psicológico o legal.',
      );
    }

    return { blocked: false };
  }

  private static response(
    category: JelpySafetyCategory,
    title: string,
    message: string,
  ): JelpySafetyResult {
    return { blocked: true, category, title, message };
  }

  private static isSexualContentRequest(t: string): boolean {
    return [
      'porno',
      'pornografia',
      'pornografía',
      'videos sexuales',
      'contenido sexual',
      'sexo explicito',
      'sexo explícito',
      'escort',
      'prostituta',
      'prostitucion',
      'prostitución',
      'servicios sexuales',
      'masajes eroticos',
      'masajes eróticos',
      'putero',
      'burdel',
    ].some((p) => this.has(t, p));
  }

  private static isDrugRequest(t: string): boolean {
    const mentionsDrug = [
      'cocaina',
      'cocaína',
      'cristal',
      'metanfetamina',
      'heroina',
      'heroína',
      'lsd',
      'fentanilo',
      'marihuana',
      'mariguana',
      'weed',
      'perico',
      'tachas',
      'extasis',
      'éxtasis',
      'droga',
      'drogas',
    ].some((p) => this.has(t, p));

    const action = [
      'comprar',
      'vender',
      'conseguir',
      'donde venden',
      'dónde venden',
      'donde compro',
      'dónde compro',
      'dealer',
      'distribuidor',
      'hacer',
      'fabricar',
      'cultivar',
    ].some((p) => this.has(t, p));

    return mentionsDrug && action;
  }

  private static isHumanViolenceRequest(t: string): boolean {
    return [
      'como matar',
      'cómo matar',
      'quiero matar',
      'como golpear',
      'cómo golpear',
      'quiero golpear',
      'como asesinar',
      'cómo asesinar',
      'quiero asesinar',
      'hacer una bomba',
      'fabricar una bomba',
      'comprar armas para matar',
      'amenazar a alguien',
      'torturar a una persona',
      'hacer daño a alguien',
      'lastimar a alguien',
    ].some((p) => this.has(t, p));
  }

  private static isAnimalViolenceRequest(t: string): boolean {
    return [
      'como matar un perro',
      'cómo matar un perro',
      'como matar un gato',
      'cómo matar un gato',
      'envenenar un perro',
      'envenenar a un perro',
      'envenenar un gato',
      'envenenar a un gato',
      'envenenar perro',
      'envenenar gato',
      'envenenar animales',
      'maltratar animales',
      'lastimar animales',
      'pelea de perros',
      'peleas de perros',
      'torturar animales',
    ].some((p) => this.has(t, p));
  }

  private static isPrivateDataRequest(t: string): boolean {
    const privateSubject = [
      'usuarios de jelpy',
      'datos de usuarios',
      'telefonos de usuarios',
      'teléfonos de usuarios',
      'correos de usuarios',
      'emails de usuarios',
      'direccion de usuarios',
      'dirección de usuarios',
      'empleados de jelpy',
      'duenos de jelpy',
      'dueños de jelpy',
      'dueno de jelpy',
      'dueño de jelpy',
      'clientes de jelpy',
      'base de datos de jelpy',
    ].some((p) => this.has(t, p));

    const requestVerb = [
      'dame',
      'pasame',
      'pásame',
      'muestrame',
      'muéstrame',
      'revela',
      'filtra',
      'descarga',
      'exporta',
      'quien es',
      'quién es',
      'contacto',
    ].some((p) => this.has(t, p));

    return privateSubject && requestVerb;
  }

  private static isInternalSecurityRequest(t: string): boolean {
    const secret = [
      'password',
      'contraseña',
      'contrasena',
      'token',
      'jwt',
      'api key',
      'apikey',
      'clave secreta',
      'secreto',
      'base de datos',
      'credenciales',
      'acceso admin',
      'panel admin',
      'codigo fuente privado',
      'código fuente privado',
    ].some((p) => this.has(t, p));

    const target = [
      'jelpy',
      'usuarios',
      'empleados',
      'duenos',
      'dueños',
      'admin',
      'produccion',
      'producción',
      'servidor',
    ].some((p) => this.has(t, p));

    return secret && target;
  }
}
