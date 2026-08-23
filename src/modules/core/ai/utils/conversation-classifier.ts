import { JELPY_SEMANTIC_CATEGORIES } from '../jelpy-assistant/constants/jelpy-semantic-categories';
import { ChatResponses } from './chat-responses';

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

  static contieneTerminoDeNegocio(texto: string): boolean {
    const textoNorm = this.normalizar(texto);

    return JELPY_SEMANTIC_CATEGORIES.some((cat) =>
      cat.aliases.some((alias) => {
        const aliasNorm = this.normalizar(alias);

        if (aliasNorm.length < 3) return false;

        const aliasEscapado = aliasNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${aliasEscapado}\\b`).test(textoNorm);
      }),
    );
  }

  static classify(
    texto: string,
    contexto: JelpyConversationContext = {},
  ): JelpyConversationClassification {
    const textoNorm = this.normalizar(texto);
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
    ].some((p) => textoNorm.includes(this.normalizar(p)));

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
    ].some((p) => textoNorm.includes(this.normalizar(p)));

    if (contexto.hasSearchContext && esPreguntaDetalle && !tieneVerboBusquedaExplicito) {
      return {
        ...base,
        intent: 'business_detail_question',
        route: 'search',
        confidence: 0.85,
      };
    }

    const esRefinamiento = [
      'mas cerca',
      'más cerca',
      'mas barato',
      'más barato',
      'abierto ahora',
      'con promo',
      'con promocion',
      'con promoción',
      'otra opcion',
      'otra opción',
      'otros',
      'solo abiertos',
    ].some((p) => textoNorm.includes(this.normalizar(p)));

    if (contexto.hasSearchContext && esRefinamiento) {
      return { ...base, intent: 'search_refinement', route: 'search', confidence: 0.85 };
    }

    if (containsBusinessTerm) {
      return { ...base, intent: 'business_search', route: 'search', confidence: 0.9 };
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
    ].some((p) => textoNorm.includes(this.normalizar(p)));

    if (tieneVerboBusqueda && textoNorm.split(' ').length >= 3) {
      return { ...base, intent: 'business_search', route: 'search', confidence: 0.7 };
    }

    if (chatIntent !== 'fallback') {
      return { ...base, intent: 'small_talk', route: 'chat', confidence: 0.9 };
    }

    return { ...base, intent: 'ambiguous', route: 'clarify', confidence: 0.55 };
  }
}
