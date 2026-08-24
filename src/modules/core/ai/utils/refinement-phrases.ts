/**
 * JLP-CONTEXT-THREAD-FIX: lista ÚNICA y compartida de frases de
 * "refinamiento" de una búsqueda que el usuario ya hizo (ej. "más cerca",
 * "más barato", "otra opción", "solo abiertos"...), incluyendo las frases
 * que Jelpy mismo ofrece como chips de seguimiento tras un resultado
 * (ej. "¿Quieres ver la más cercana a ti?" contiene "mas cerca" como
 * substring de "mas cercana", así que también cae aquí).
 *
 * Bug real reportado por el usuario: tras buscar "farmacias abiertas",
 * Jelpy ofrecía el chip "¿Quieres ver la más cercana a ti?". Al tocarlo,
 * respondía "No entendí bien, pero puedo ayudarte a buscar en Tepic" —
 * rompiendo por completo el hilo de la conversación.
 *
 * Causa raíz: existían DOS listas independientes que debían significar lo
 * mismo pero vivían en archivos distintos y se habían desincronizado:
 *   - ConversationClassifier.esRefinamiento: decidía la RUTA/INTENT
 *     (chat/search/clarify) de un mensaje corto de seguimiento.
 *   - ContextResolverUseCase (rama "variante de búsqueda"): decidía si el
 *     TEXTO enviado al buscador real se enriquecía con la query anterior
 *     (ej. anteponer "farmacia" a "más cercana a ti").
 * Como no coincidían, un chip de refinamiento podía clasificarse bien
 * (`search_refinement`) pero el texto real que llegaba al motor de
 * búsqueda seguía siendo solo "más cercana a ti" (sin categoría) — o,
 * peor todavía, si además `hasSearchContext` era falso (sesión perdida
 * por un `sessionId` no reenviado por el cliente), caía directo en
 * "No entendí bien".
 *
 * Esta lista es ahora la ÚNICA fuente de verdad para ambos usos. Si se
 * agrega una frase de refinamiento nueva (o un chip nuevo que la use),
 * agregarla aquí una sola vez.
 */
export const REFINEMENT_PHRASES = [
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
];
