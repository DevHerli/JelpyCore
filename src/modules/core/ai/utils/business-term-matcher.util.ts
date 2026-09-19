/**
 * JLP-CONECTOR-OPCIONAL-FIX: bug reportado por el usuario — buscó "trauma"
 * (que ya se resuelve correctamente, ver JLP-ESPECIALIDAD-BUSQUEDA-FIX) y
 * luego, en el mismo hilo de conversación, escribió "Corte pelo" (sin la
 * palabra "de") esperando una búsqueda de barbería/salón de belleza
 * completamente nueva e independiente. Como el alias registrado en
 * `JELPY_SEMANTIC_CATEGORIES` es la frase exacta "corte de pelo", el
 * chequeo de "¿esto es un término de negocio?" (`contieneTerminoDeNegocio`,
 * duplicado en `ConversationClassifier` y `AiService`) NO reconoció "corte
 * pelo" como término de negocio. Al no detectarse ningún término nuevo,
 * `ContextResolverUseCase` (regla de "respaldo genérico", ver
 * JLP-CONTEXT-THREAD-FIX) asumió que el mensaje era continuación de la
 * búsqueda anterior ("trauma") y le antepuso esa query vieja, mandando a
 * FastAPI el texto sin sentido "Traumatologo Corte pelo" — que, con toda
 * razón, no supo interpretar y devolvió una respuesta genérica de "no
 * entendí", rompiendo por completo la búsqueda nueva del usuario.
 *
 * Causa raíz: los alias/servicios de varias palabras en
 * `JELPY_SEMANTIC_CATEGORIES` casi siempre incluyen conectores gramaticales
 * ("corte DE pelo", "salón DE belleza", "tienda DE mascotas"...) que en la
 * escritura informal se omiten constantemente ("corte pelo", "salon
 * belleza", "tienda mascotas"). El chequeo anterior exigía una coincidencia
 * LITERAL de la frase completa (incluido el conector), así que cualquier
 * alias/servicio de 2+ palabras con un conector se volvía frágil ante la
 * simple omisión de esa palabra de relleno.
 *
 * Este helper compartido (usado por `ConversationClassifier` y `AiService`
 * para no duplicar — y volver a desincronizar — la misma lógica) tokeniza
 * el término del diccionario, separa las palabras de relleno de las
 * palabras con contenido real, y arma un patrón donde el conector es
 * OPCIONAL entre palabras de contenido consecutivas. Así "corte pelo" y
 * "corte de pelo" (o "salon belleza" y "salón de belleza") se reconocen
 * como el mismo término de negocio, sin afectar en nada a los alias de una
 * sola palabra (la gran mayoría del diccionario), que siguen comparándose
 * exactamente igual que antes.
 */
const CONECTORES_OPCIONALES = ['de', 'del', 'la', 'el', 'los', 'las'];

/**
 * ¿El texto ya normalizado (mismas reglas de normalización aplicadas a
 * ambos lados por el llamador) contiene el término de negocio ya
 * normalizado, tolerando la presencia u omisión de conectores
 * gramaticales entre las palabras con contenido del término?
 */
export function coincideTerminoDeNegocio(
  textoNormalizado: string,
  terminoNormalizado: string,
): boolean {
  if (!terminoNormalizado || terminoNormalizado.length < 3) return false;

  const tokens = terminoNormalizado.split(' ').filter(Boolean);
  const tokensSignificativos = tokens.filter((t) => !CONECTORES_OPCIONALES.includes(t));

  // Término compuesto SOLO por conectores (no debería pasar en la práctica,
  // pero por seguridad no se considera un match).
  if (tokensSignificativos.length === 0) return false;

  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokensEscapados = tokensSignificativos.map(escapar);

  const separador = `(?:\\s+(?:${CONECTORES_OPCIONALES.join('|')}))?\\s+`;
  const patron = tokensEscapados.join(separador);

  return new RegExp(`\\b${patron}\\b`).test(textoNormalizado);
}
