import { JELPY_SEMANTIC_CATEGORIES } from '../jelpy-assistant/constants/jelpy-semantic-categories';
import { ChatResponses } from './chat-responses';
import { TextNormalizer } from './text-normalizer';
import { REFINEMENT_PHRASES } from './refinement-phrases';
import { coincideTerminoDeNegocio } from './business-term-matcher.util';

export type JelpyConversationIntent =
  | 'small_talk'
  | 'business_search'
  | 'search_refinement'
  | 'business_detail_question'
  | 'support_or_complaint'
  | 'out_of_scope'
  | 'ambiguous';

export type JelpyConversationRoute = 'chat' | 'search' | 'clarify';

export interface JelpyConversationClassification {
  intent: JelpyConversationIntent;
  route: JelpyConversationRoute;
  chatIntent: string;
  containsBusinessTerm: boolean;
  confidence: number;
}

export interface JelpyConversationContext {
  hasSearchContext?: boolean;
}

export class ConversationClassifier {
  static normalizar(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¿?¡!.,;:()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * JLP-PHONETIC-FIX: clave fonética (ver `TextNormalizer`) usada para
   * emparejar frases tolerando faltas de ortografía comunes en español
   * mexicano informal (seseo, yeísmo, betacismo, h muda, letras repetidas).
   * Se usa en `contieneTerminoDeNegocio` y en los `.some()` de abajo,
   * SIEMPRE aplicada a ambos lados de la comparación (texto del usuario Y
   * la palabra/alias contra la que se compara), para que "kien erez",
   * "quien eres" y variantes con faltas produzcan la misma clave.
   */
  static clavefonetica(texto: string): string {
    return TextNormalizer.clavefonetica(texto);
  }

  static contieneTerminoDeNegocio(texto: string): boolean {
    // JLP-PHONETIC-FIX: clave fonética en ambos lados (texto del usuario Y
    // cada alias) para tolerar faltas de ortografía ("restaurantez",
    // "farmasia") sin depender de una lista de correcciones a mano.
    const textoNorm = this.clavefonetica(texto);

    // JLP-ESPECIALIDAD-BUSQUEDA-FIX: bug reportado por el usuario — pidió
    // "trauma"/"traumatologo"/"traumatologia" (sin decir "doctor" ni
    // "médico" a su lado) y Jelpy respondió "no encontré resultados" pese a
    // existir un doctor con esa especialidad dado de alta. Causa raíz: este
    // método SOLO revisaba `cat.aliases` (palabras sombrilla como "doctor",
    // "medico", "clinica"), nunca `cat.servicios` (nombres reales de
    // especialidad/servicio, ej. "Traumatología", "pediatra", "cardiologo").
    // Como el texto era una especialidad SOLA, sin ningún alias al lado,
    // `containsBusinessTerm` daba `false` y `classify()` nunca enrutaba a
    // 'search' — la petición se quedaba atrapada en el flujo conversacional
    // (`responderConversacional`) y jamás llegaba a la búsqueda real ni al
    // enriquecimiento semántico de `JelpyAssistantService`. Ahora también se
    // revisan los `servicios` de cada categoría.
    //
    // JLP-CONECTOR-OPCIONAL-FIX: `coincideTerminoDeNegocio` (helper
    // compartido) además tolera que el usuario omita conectores
    // gramaticales dentro de alias/servicios de varias palabras (ej.
    // "corte pelo" reconoce el alias "corte de pelo") — ver el comentario
    // de ese archivo para el bug exacto que esto corrige.
    return JELPY_SEMANTIC_CATEGORIES.some((cat) =>
      [...cat.aliases, ...(cat.servicios || [])].some((termino) =>
        coincideTerminoDeNegocio(textoNorm, this.clavefonetica(termino)),
      ),
    );
  }

  static classify(
    texto: string,
    contexto: JelpyConversationContext = {},
  ): JelpyConversationClassification {
    // JLP-PHONETIC-FIX: clave fonética, no solo normalización básica, para
    // que las comparaciones de abajo (`.some(...)`) toleren faltas de
    // ortografía comunes (ver `TextNormalizer`). El conteo de palabras
    // (`.split(' ').length`) no se ve afectado: la clave fonética colapsa
    // letras dentro de cada palabra, pero preserva los espacios.
    const textoNorm = this.clavefonetica(texto);
    const chatIntent = ChatResponses.detectarIntent(texto);
    const containsBusinessTerm = this.contieneTerminoDeNegocio(texto);

    const base = {
      chatIntent,
      containsBusinessTerm,
    };

    if (!textoNorm || chatIntent === 'confuso') {
      return { ...base, intent: 'ambiguous', route: 'clarify', confidence: 0.75 };
    }

    if (chatIntent === 'fuera_de_alcance') {
      return { ...base, intent: 'out_of_scope', route: 'chat', confidence: 0.9 };
    }

    if (chatIntent === 'queja' || chatIntent === 'humano_escalar') {
      return { ...base, intent: 'support_or_complaint', route: 'chat', confidence: 0.9 };
    }

    const esPreguntaDetalle = [
      'telefono',
      'teléfono',
      'numero',
      'número',
      'direccion',
      'dirección',
      'horario',
      'ubicacion',
      'ubicación',
      'domicilio',
      'envio',
      'envío',
      'precio',
      'precios',
    ].some((p) => textoNorm.includes(this.clavefonetica(p)));

    // JLP-DETAIL-VS-SEARCH-FIX: palabras como "teléfono", "número",
    // "precio" o "domicilio" son AMBIGUAS — son a la vez palabras de
    // pregunta de seguimiento ("¿cuál es su teléfono?") Y alias reales de
    // negocio en JELPY_SEMANTIC_CATEGORIES (ej. tiendas de celulares,
    // servicios a domicilio). El guard original (`!containsBusinessTerm`)
    // se anulaba a sí mismo casi siempre para estas palabras, porque
    // CASI SIEMPRE son también un término de negocio — por eso "¿cuál es
    // el teléfono?" con una búsqueda activa se clasificaba como una NUEVA
    // búsqueda de negocio en vez de una pregunta sobre el resultado
    // anterior (bug detectado por la suite de pruebas de conversación).
    //
    // La señal correcta para distinguir "quiero un teléfono nuevo"
    // (búsqueda real) de "¿cuál es su teléfono?" (pregunta de detalle) es
    // la presencia de un verbo de intención de búsqueda EXPLÍCITO, no si
    // la palabra coincide con el diccionario de negocio.
    const tieneVerboBusquedaExplicito = [
      'busco', 'buscar', 'quiero', 'necesito', 'comprar', 'venden', 'vendan',
      'dame', 'recomiendame', 'recomiéndame', 'encuentra', 'donde hay', 'dónde hay',
    ].some((p) => textoNorm.includes(this.clavefonetica(p)));

    if (contexto.hasSearchContext && esPreguntaDetalle && !tieneVerboBusquedaExplicito) {
      return {
        ...base,
        intent: 'business_detail_question',
        route: 'search',
        confidence: 0.85,
      };
    }

    // JLP-CONTEXT-THREAD-FIX: lista compartida con `ContextResolverUseCase`
    // (ver `refinement-phrases.ts`) para que la clasificación de ruta y el
    // enriquecimiento del texto real de búsqueda usen SIEMPRE el mismo
    // criterio de "esto es un refinamiento de la búsqueda anterior".
    const esRefinamiento = REFINEMENT_PHRASES.some((p) => textoNorm.includes(this.clavefonetica(p)));

    if (contexto.hasSearchContext && esRefinamiento) {
      return { ...base, intent: 'search_refinement', route: 'search', confidence: 0.85 };
    }

    if (containsBusinessTerm) {
      return { ...base, intent: 'business_search', route: 'search', confidence: 0.9 };
    }

    // JLP-TIENDAS-UMBRELLA-FIX: bug reportado por el usuario — "quiero
    // tiendas cerca" (verbo de búsqueda explícito + palabra SOMBRILLA)
    // caía en el bloque de abajo (`tieneVerboBusqueda`) como una búsqueda
    // real, disparaba la llamada a FastAPI, no encontraba nada mapeable a
    // "tiendas" y terminaba en la corrección ortográfica sin sentido
    // "¿Quisiste decir 'bandas'?" (mismo bug ya visto con "quiero comida
    // cerca" → "¿Quisiste decir 'cocido'?"). Las palabras sombrilla
    // (comida/salud/belleza/servicios/tiendas) NUNCA deben convertirse en
    // una búsqueda directa sin importar el verbo que las acompañe: siempre
    // necesitan un paso más de aclaración (`ChatResponses.
    // responderCategoriaUmbrella`), así que se interceptan aquí, ANTES de
    // evaluar verbos de búsqueda.
    if (ChatResponses.detectarCategoriaUmbrella(texto)) {
      return { ...base, intent: 'ambiguous', route: 'clarify', confidence: 0.6 };
    }

    const tieneVerboBusqueda = [
      'busco',
      'buscar',
      'quiero',
      'necesito',
      'donde hay',
      'dónde hay',
      'recomiendame',
      'recomiéndame',
      'dame opciones',
      'encuentra',
    ].some((p) => textoNorm.includes(this.clavefonetica(p)));

    if (tieneVerboBusqueda && textoNorm.split(' ').length >= 3) {
      return { ...base, intent: 'business_search', route: 'search', confidence: 0.7 };
    }

    if (chatIntent !== 'fallback') {
      return { ...base, intent: 'small_talk', route: 'chat', confidence: 0.9 };
    }

    // JLP-CONTEXT-THREAD-FIX: bug reportado por el usuario — Jelpy ofrece
    // decenas de chips de seguimiento distintos por categoría (ver
    // `suggestions.util.ts`: "¿Quieres ver cuáles tienen medicamentos
    // genéricos?", "¿Buscas alguna especialidad médica?", "¿Quieres ver
    // los precios disponibles?"...). Enumerarlos todos a mano en
    // `REFINEMENT_PHRASES`/`PALABRAS_SEGUIMIENTO` es una lista que nunca
    // termina de estar completa y que ya se desincronizó dos veces antes.
    //
    // Si llegamos hasta aquí, ya descartamos: saludo/despedida/queja/fuera
    // de alcance (chatIntent !== 'fallback' arriba), un término de negocio
    // nuevo propio (containsBusinessTerm) y un verbo de búsqueda explícito.
    // O sea: es un mensaje corto que no sabemos clasificar con precisión.
    // Si además hay una búsqueda activa en la sesión, la opción MENOS mala
    // es asumir que es continuación/refinamiento de esa búsqueda (y dejar
    // que `ContextResolverUseCase` enriquezca el texto con la query
    // anterior) en vez de responder "no entendí" y romper el hilo de la
    // conversación — que es exactamente lo que los usuarios reportan como
    // "Jelpy no funciona".
    // JLP-UMBRELLA-CONTEXTO-FIX: las palabras SOMBRILLA (comida/salud/
    // belleza/servicios/tiendas — ver `ChatResponses.detectarCategoriaUmbrella`)
    // ya se interceptaron arriba y nunca llegan hasta aquí, así que si
    // hay una búsqueda anterior activa en la sesión, este mensaje corto y
    // sin clasificar es, con seguridad, una continuación/refinamiento de
    // ESA búsqueda (y no una palabra sombrilla nueva) — dejamos que
    // `ContextResolverUseCase` enriquezca el texto con la query anterior
    // en vez de responder "no entendí" y romper el hilo de la
    // conversación.
    if (contexto.hasSearchContext) {
      return { ...base, intent: 'search_refinement', route: 'search', confidence: 0.5 };
    }

    return { ...base, intent: 'ambiguous', route: 'clarify', confidence: 0.55 };
  }
}
