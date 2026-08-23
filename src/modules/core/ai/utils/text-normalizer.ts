/**
 * JLP-PHONETIC-FIX: normalizador fonético compartido para la CAPA
 * CONVERSACIONAL (ConversationClassifier, ChatResponses).
 *
 * Contexto del bug que esto resuelve: "Kien erez" (typo real reportado por
 * un usuario) no se reconocía como "quién eres" porque las listas de
 * corrección eran un diccionario fijo palabra-por-palabra (kien→quién,
 * komo→cómo...) que nunca iba a cubrir todas las faltas de ortografía
 * posibles — mucha gente en México escribe rápido/informal y confunde
 * letras que en español suenan igual: s/z/c (seseo: "grasias"), b/v
 * (betacismo: "aver"), ll/y (yeísmo: "yamas"), h muda que se omite o
 * sobra ("ay" por "hay"), y letras repetidas por error de tecleo
 * ("polllo").
 *
 * En vez de seguir agregando palabras sueltas a una lista infinita, esta
 * clase calcula una "clave fonética": una forma canónica del texto donde
 * todas esas confusiones colapsan al mismo resultado. Si se aplica la
 * MISMA función tanto al texto del usuario como a la palabra clave contra
 * la que se compara, entonces "kien erez", "quien eres" y "kien eres"
 * terminan produciendo exactamente la misma clave y se reconocen como
 * iguales — sin necesidad de listar cada variante a mano.
 *
 * IMPORTANTE: esto es solo para EMPAREJAR intención conversacional (saludo,
 * identidad, gracias, queja...). No se usa para el texto que se le muestra
 * de vuelta al usuario ni para la corrección ortográfica que alimenta la
 * búsqueda de negocios real (eso lo sigue haciendo OrthographyCheckUseCase,
 * que es deliberadamente conservador porque su salida sí es visible/usada
 * para buscar).
 */
export class TextNormalizer {
  /** Minúsculas, sin acentos, sin signos de puntuación, espacios colapsados. */
  static normalizarBasico(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Clave fonética: colapsa las confusiones ortográficas más comunes del
   * español informal/mexicano para que dos formas distintas de escribir lo
   * mismo produzcan el mismo resultado. Ver comentario de la clase.
   */
  static clavefonetica(texto: string): string {
    let t = this.normalizarBasico(texto);
    if (!t) return t;

    // Proteger el dígrafo "ch": es un fonema propio del español, no una
    // "h muda" que se pueda eliminar como el resto de las haches.
    t = t.replace(/ch/g, '§');

    // Letras triples o más por error de tecleo ("polllo") se reducen al
    // MÁXIMO a una pareja doble ("pollo"), nunca a una sola letra: así se
    // conserva la posibilidad de que sea el dígrafo "ll" antes de
    // convertirlo más abajo. La limpieza de dobles genuinamente accidentales
    // ("commo"→"como") ocurre al final, después de resolver "ll".
    t = t.replace(/(.)\1{2,}/g, '$1$1');

    // Seseo: "c" antes de e/i y toda "z" suenan como "s" en español
    // mexicano ("cielo"/"sielo", "erez"→"eres", "grasias"/"gracias").
    t = t.replace(/c(?=[ei])/g, 's');
    t = t.replace(/z/g, 's');

    // El resto de "c" (antes de a/o/u o consonante) y "qu" suenan como "k"
    // ("komo"/"como", "kien"/"quien").
    t = t.replace(/qu(?=[ei])/g, 'k');
    t = t.replace(/c/g, 'k');

    // Yeísmo: "ll" y "y" suenan igual ("yamas"/"llamas").
    t = t.replace(/ll/g, 'y');

    // Betacismo: "b" y "v" suenan igual ("aver"/"haber").
    t = t.replace(/v/g, 'b');

    // H muda (fuera del dígrafo "ch", ya protegido arriba): se omite o
    // sobra constantemente en escritura informal ("ay"/"hay", "aora"/"ahora").
    t = t.replace(/h/g, '');

    // Restaurar el dígrafo protegido.
    t = t.replace(/§/g, 'ch');

    // Cualquier pareja doble que sobreviva hasta aquí (ya no puede ser el
    // dígrafo "ll", resuelto arriba) es casi siempre un error de tecleo
    // ("commo"→"como", "hoola"→"hola") y se colapsa a una sola letra.
    t = t.replace(/(.)\1+/g, '$1');

    return t.replace(/\s+/g, ' ').trim();
  }
}
