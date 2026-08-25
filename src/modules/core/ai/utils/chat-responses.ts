import { TextNormalizer } from './text-normalizer';

export class ChatResponses {

  // =====================================================
  // UTILIDADES
  // =====================================================

  /**
   * JLP-PHONETIC-FIX: devuelve la CLAVE FONÉTICA del texto (ver
   * `TextNormalizer`), no solo una limpieza básica. Esto es lo que permite
   * que "Kien erez" se reconozca como "quién eres" — la clave colapsa
   * confusiones comunes del español informal mexicano (seseo, yeísmo,
   * betacismo, h muda, letras repetidas) en vez de depender de una lista
   * fija de palabras mal escritas.
   *
   * Como el resultado ya NO es texto legible (p.ej. "gracias" se convierte
   * en "grasias"), todas las comparaciones de este archivo usan el helper
   * `tieneFrase(t, frase)` de abajo en vez de `t.includes('texto plano')` —
   * necesario para que la frase contra la que se compara pase por la misma
   * transformación y la comparación tenga sentido.
   */
  static normalizar(texto: string): string {
    return TextNormalizer.clavefonetica(texto);
  }

  /**
   * ¿La clave fonética de `t` (ya normalizado con `normalizar()`) contiene
   * la clave fonética de `frase`? Reemplaza los antiguos
   * `t.includes('texto plano')`.
   */
  private static tieneFrase(t: string, frase: string): boolean {
    return t.includes(this.normalizar(frase));
  }

  /**
   * JLP-SALUDO-CORTO-FIX: la clave fonética elimina la "h muda" del español
   * ("ay"/"hay"), pero "hi" y "hey" son préstamos del inglés donde la "h"
   * SÍ se pronuncia — al quitarla quedan en "i" y "ey" (1-2 caracteres),
   * justo el rango que el guard de "entrada muy corta / confuso" trata
   * como relleno sin sentido. Sin este chequeo, alguien que escribe "hi" o
   * "hey" cae en "no entendí" en vez de recibir un saludo (bug encontrado
   * por la suite de regresión de saludos). Se compara con la clave
   * fonética de las propias palabras (no con literales "i"/"ey" sueltos)
   * para que, si el normalizador cambia, esto se mantenga en sincronía.
   */
  private static esSaludoCortoEspecial(t: string): boolean {
    return t === this.normalizar('hi') || t === this.normalizar('hey');
  }

  /** Elige un elemento al azar de un array */
  private static elegir<T>(opciones: T[]): T {
    return opciones[Math.floor(Math.random() * opciones.length)];
  }

  /** Saludo según la hora del día */
  private static saludoPorHora(): string {
    const h = new Date().getHours();
    if (h >= 6 && h < 12)  return 'Buenos días';
    if (h >= 12 && h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /** Emoji de saludo aleatorio */
  private static emojiSaludo(): string {
    return this.elegir(['👋', '😊', '🙌', '✨', '💙']);
  }

  /**
   * Verifica si el texto contiene alguna de las palabras/frases dadas,
   * respetando límites de palabra (evita falsos positivos por substring).
   * Ej: 'promo' no debe matchear dentro de 'promocionar' de forma accidental
   * en frases donde no aplica, pero sí debe matchear la palabra suelta "promo".
   */
  private static match(t: string, palabras: string[]): boolean {
    return palabras.some((p) => {
      // JLP-PHONETIC-FIX: normalizamos `p` igual que `t` (ambos ya deben
      // venir de `this.normalizar`) para que las listas de sinónimos
      // (PROMO_KEYWORDS, QUEJA_KEYWORDS...) toleren faltas de ortografía.
      const normalizada = this.normalizar(p);
      const escapada = normalizada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escapada}\\b`).test(t);
    });
  }

  // =====================================================
  // GRUPOS DE SINÓNIMOS (capa conversacional)
  // Nota: esto es independiente del diccionario de negocio
  // (JELPY_SEMANTIC_CATEGORIES), que cubre entidades de búsqueda
  // (doctor, sushi, barbería...). Este set cubre intención conversacional.
  // =====================================================
  private static readonly PROMO_KEYWORDS = [
    'promo', 'promos', 'promocion', 'promociones',
    'oferta', 'ofertas', 'descuento', 'descuentos',
    'rebaja', 'rebajas', 'cupon', 'cupones', '2x1',
  ];

  private static readonly PRECIO_KEYWORDS = [
    'precio', 'precios', 'costo', 'costos', 'cuanto cuesta',
    'cuanto vale', 'cuanto sale', 'tarifa', 'tarifas', 'cotizacion',
    'que precio tiene', 'cuanto cobran',
  ];

  private static readonly HUMANO_KEYWORDS = [
    'hablar con humano', 'hablar con una persona', 'hablar con alguien',
    'quiero un agente', 'quiero un representante', 'atencion personalizada',
    'no quiero un bot', 'no eres humano quiero uno', 'operador',
    'persona real', 'soporte humano', 'quiero hablar con soporte',
  ];

  /** Quejas / molestia del usuario (no incluye las frases ya cubiertas
   * como "no funciona"/"no sirve" en el detector de frustración de AiService,
   * que intercepta antes de llegar aquí; esto amplía cobertura de sinónimos). */
  private static readonly QUEJA_KEYWORDS = [
    'mal servicio', 'pesima', 'pesimo servicio', 'terrible', 'fatal',
    'que porqueria', 'un desastre', 'malisimo', 'malisima', 'deficiente',
    'estafa', 'engaño', 'me engañaron', 'ya me canse', 'que mal',
    'quiero quejarme', 'tengo una queja', 'quiero poner una queja',
    'reclamo', 'quiero reclamar', 'no puede ser', 'no es posible',
    'esto esta mal', 'que decepcion',
  ];

  private static readonly AGENDAR_CITA_KEYWORDS = [
    'agendar', 'agendar cita', 'quiero una cita', 'sacar cita',
    'hacer cita', 'programar cita', 'apartar cita', 'apartar turno',
    'separar horario', 'reservar turno', 'quiero reservar',
    'como agendo', 'como saco cita', 'quiero agendar',
  ];

  // =====================================================
  // SUGERENCIAS DINÁMICAS (chips)
  // Importante: cada frase de este catálogo está armada con alias reales
  // del diccionario de negocio (JELPY_SEMANTIC_CATEGORIES) — "tacos",
  // "doctor", "spa", "barbería", etc. — para que si el usuario TOCA el
  // chip (y el texto se reenvía tal cual como si lo hubiera escrito), el
  // mensaje SIEMPRE se reconozca correctamente (ya sea como búsqueda real
  // o como intención conversacional válida) y nunca caiga en el
  // "No entendí bien" genérico. Antes los chips eran preguntas fijas
  // ("¿Quieres buscar algo cerca de ti?") que no coincidían con ningún
  // patrón de detección — de ahí el bug reportado.
  // =====================================================
  private static readonly POOL_COMIDA = [
    'Tacos cerca de mí', 'Sushi cerca de mí', 'Restaurantes cerca de mí',
  ];

  private static readonly POOL_SALUD = [
    'Doctor cerca de mí', 'Farmacia abierta', 'Dentista cerca de mí',
  ];

  private static readonly POOL_BELLEZA = [
    'Barbería cerca de mí', 'Spa cerca de mí', 'Peluquería cerca de mí',
  ];

  private static readonly POOL_EXPLORAR = [
    'Hotel cerca de mí', 'Gimnasio cerca de mí', 'Veterinaria cerca de mí',
  ];

  private static readonly POOL_PROMOS = [
    'Promociones de tacos', 'Promociones de sushi', 'Promociones de spa',
    'Promociones de barbería', 'Promociones de farmacia',
  ];

  /** Elige N elementos distintos al azar de un array (sin repetir). */
  private static elegirVarios<T>(opciones: T[], n: number): T[] {
    const copia = [...opciones];
    const resultado: T[] = [];

    while (copia.length > 0 && resultado.length < n) {
      const idx = Math.floor(Math.random() * copia.length);
      resultado.push(copia.splice(idx, 1)[0]);
    }

    return resultado;
  }

  /**
   * Genera chips de sugerencia contextuales y dinámicos según la intención
   * conversacional detectada (ver `detectarIntent`). Reemplaza al set fijo
   * de 2 sugerencias genéricas que se repetía siempre igual, sin importar
   * de qué se estuviera hablando.
   *
   * Reglas de diseño:
   *  - En intents sensibles (queja, escalar a humano, despedida) NO se
   *    empujan chips: no es el momento de "vender" otra búsqueda.
   *  - En el resto, se arma un pool relevante al tema y se eligen 2-3 al
   *    azar cada vez, para que no se sientan repetitivos.
   */
  static generarSugerencias(intentGranular: string): string[] {
    switch (intentGranular) {
      case 'queja':
      case 'humano_escalar':
      case 'despedida':
        return [];

      // Capa 2 — búsqueda guiada: un chip representativo de cada categoría
      // grande (comida, salud, belleza, explorar) para que la pregunta de
      // aclaración ("¿comida, salud, belleza o servicios?") tenga una
      // respuesta de un solo tap, cubriendo las áreas más buscadas.
      case 'clarificar_busqueda':
        return [
          this.elegir(this.POOL_COMIDA),
          this.elegir(this.POOL_SALUD),
          this.elegir(this.POOL_BELLEZA),
          this.elegir(this.POOL_EXPLORAR),
        ];

      case 'promociones':
        return this.elegirVarios(this.POOL_PROMOS, 3);

      case 'agendar_cita':
        return this.elegirVarios([...this.POOL_SALUD, ...this.POOL_BELLEZA], 3);

      case 'precio':
      case 'ubicacion':
        return this.elegirVarios([...this.POOL_COMIDA, ...this.POOL_SALUD], 2);

      case 'capacidades':
      case 'guia_uso':
      case 'recomendacion_general':
        return this.elegirVarios(
          [...this.POOL_COMIDA, ...this.POOL_EXPLORAR, ...this.POOL_PROMOS],
          3,
        );

      case 'saludo':
      case 'presencia':
      case 'gracias':
      case 'confuso':
      case 'no_entiende':
      case 'fallback':
      default:
        return this.elegirVarios(
          [...this.POOL_COMIDA, ...this.POOL_SALUD, ...this.POOL_BELLEZA, ...this.POOL_PROMOS],
          3,
        );
    }
  }

  /**
   * Etiquetas de intención "repetibles": si el usuario vuelve a preguntar
   * lo mismo en la misma sesión, conviene reconocerlo en vez de repetir
   * el bloque completo (se siente robótico). No incluye intenciones
   * transaccionales (promociones, precio, agendar, saludo...) porque ahí
   * repetir la pregunta es normal y esperado.
   */
  private static readonly INTENTS_REPETIBLES = [
    'identidad', 'chatbot_ia', 'identidad_corporativa', 'capacidades', 'guia_uso',
  ];

  /**
   * Capa 2 — búsqueda guiada.
   *
   * Se usa cuando el mensaje no fue reconocido como ninguna intención
   * conversacional conocida (saludo, gracias, identidad, promociones...)
   * NI como una búsqueda de negocio real (ConversationClassifier: route
   * 'clarify', chatIntent 'fallback'). En vez del "No entendí bien, prueba
   * algo como..." genérico y pasivo, hace una pregunta DIRIGIDA que le da
   * al usuario un camino claro para continuar: qué categoría y, si falta,
   * en qué ciudad. Se combina con chips de categoría (ver
   * `generarSugerencias('clarificar_busqueda')`) para que responder sea un
   * solo tap.
   */
  static preguntarAclaracionBusqueda(ciudad?: string): { titulo: string; mensaje: string } {
    const tieneCiudad = !!(ciudad || '').trim();
    const enCiudad = tieneCiudad ? ` en ${ciudad}` : '';

    return {
      titulo: this.elegir(['Ayúdame a entenderte mejor 🤔', '¿Qué tipo de lugar buscas? 🧭']),
      mensaje: tieneCiudad
        ? this.elegir([
            `No estoy seguro de qué buscas${enCiudad}. ¿Es comida, salud, belleza o algún servicio? Cuéntame y te ayudo.`,
            `Dime un poco más: ¿comida, salud, belleza o servicios${enCiudad}? Así te muestro justo lo que necesitas.`,
          ])
        : this.elegir([
            'No estoy seguro de qué buscas. ¿Es comida, salud, belleza o algún servicio? Dime también tu ciudad para afinar la búsqueda.',
            '¿Qué tipo de lugar te interesa: comida, salud, belleza o servicios? Y ¿en qué ciudad buscas?',
          ]),
    };
  }

  /**
   * JLP-CHIP-RECUPERACION-FIX: bug reportado por el usuario — tras una
   * búsqueda SIN resultados, Jelpy ofrece chips de recuperación
   * ("¿Quieres intentar con otra palabra?", "¿Buscas algo diferente en
   * {ciudad}?", "¿Quieres ampliar la búsqueda a otra categoría?", "¿Quieres
   * buscar en otra ciudad?" — ver `SugerenciasUtil.generar()`, rama
   * `items.length === 0`). Estos 4 chips NO son frases de negocio
   * autosuficientes como "Tacos cerca de mí": son PREGUNTAS META que piden
   * al usuario un dato que todavía no dio (una palabra nueva, otra
   * categoría, otra ciudad). Al tocarlos, el texto literal del chip
   * ("¿Buscas algo diferente en Tepic?") se enviaba al pipeline de
   * clasificación/búsqueda como si fuera una consulta real, y terminaba en
   * "No entendí bien" — literalmente lo opuesto de lo que el chip prometía.
   *
   * Reporte textual del usuario: "los chips que ves dice quieres tratar con
   * otra palabra? pero no da opciones, o deberia ser informativo y no
   * opcional un chip [...] lo seleccionas y dice no entendi! que
   * incongruente es eso!"
   *
   * Este detector se usa para INTERCEPTAR esos 4 textos ANTES de que
   * entren a `ContextResolverUseCase`/`ConversationClassifier`, y
   * responder con una pregunta dirigida (igual que `preguntarAclaracionBusqueda`)
   * en vez de intentar una búsqueda con el texto del chip.
   */
  static detectarChipRecuperacionSinResultados(
    texto: string,
  ): 'otra_palabra' | 'otra_categoria' | 'otra_ciudad' | null {
    const t = this.normalizar(texto);

    if (this.tieneFrase(t, 'quieres intentar con otra palabra')) return 'otra_palabra';
    if (this.tieneFrase(t, 'buscas algo diferente en')) return 'otra_palabra';
    if (this.tieneFrase(t, 'quieres ampliar la busqueda a otra categoria')) return 'otra_categoria';
    if (this.tieneFrase(t, 'quieres buscar en otra ciudad')) return 'otra_ciudad';

    return null;
  }

  /**
   * Respuesta "informativa" (no una búsqueda a ciegas) para los chips de
   * recuperación sin resultados detectados por
   * `detectarChipRecuperacionSinResultados`. Sigue el mismo patrón que
   * `preguntarAclaracionBusqueda`: pregunta dirigida + chips de
   * `generarSugerencias('clarificar_busqueda')` para que responder sea un
   * solo tap.
   */
  static responderChipRecuperacion(
    tipo: 'otra_palabra' | 'otra_categoria' | 'otra_ciudad',
    ciudad?: string,
  ): { titulo: string; mensaje: string } {
    const tieneCiudad = !!(ciudad || '').trim();
    const enCiudad = tieneCiudad ? ` en ${ciudad}` : '';

    switch (tipo) {
      case 'otra_categoria':
        return {
          titulo: this.elegir(['¿Qué categoría te gustaría explorar? 🧭', 'Vamos a probar otra categoría 🧭']),
          mensaje: `Dime qué tipo de lugar buscas${enCiudad}: comida, salud, belleza, servicios... y te muestro opciones.`,
        };

      case 'otra_ciudad':
        return {
          titulo: this.elegir(['¿En qué ciudad buscamos? 📍', 'Cambiemos de ciudad 📍']),
          mensaje: 'Dime el nombre de la ciudad donde quieres que busque y con gusto te ayudo.',
        };

      case 'otra_palabra':
      default:
        return {
          titulo: this.elegir(['¡Claro, intentemos de nuevo! 🔍', 'Vamos a intentarlo de otra forma 🔍']),
          mensaje: `Escríbeme qué te gustaría buscar${enCiudad} (por ejemplo un negocio, categoría o servicio) y lo intento otra vez.`,
        };
    }
  }

  /**
   * Clasifica el mensaje en una etiqueta corta de intención conversacional,
   * sin generar la respuesta. Se usa para:
   *  1) Persistir en el historial de turnos qué se habló (memoria de sesión).
   *  2) Detectar si el usuario repite la misma intención (ver responder()).
   * Nota: replica las mismas condiciones que responder() a propósito —
   * es una capa de solo-etiquetado, no decide qué texto se muestra.
   */
  static detectarIntent(input: string): string {
    const t = this.normalizar(input);

    if (
      this.tieneFrase(t, 'tarea') || this.tieneFrase(t, 'resumen') || this.tieneFrase(t, 'matematica') ||
      this.tieneFrase(t, 'quimica') || this.tieneFrase(t, 'fisica') || this.tieneFrase(t, 'codigo') ||
      this.tieneFrase(t, 'programacion') || this.tieneFrase(t, 'investigacion')
    ) return 'fuera_de_alcance';

    if (!this.esSaludoCortoEspecial(t) && (t.length <= 2 || ['aaa','emm','mmm','eh','ok','no se','nop','np'].includes(t))) return 'confuso';

    if (this.match(t, this.QUEJA_KEYWORDS)) return 'queja';

    if (
      this.tieneFrase(t, 'quien eres') || this.tieneFrase(t, 'que eres') || this.tieneFrase(t, 'como te llamas') ||
      this.tieneFrase(t, 'cual es tu nombre') || this.tieneFrase(t, 'tu nombre') || this.tieneFrase(t, 'llamas') ||
      this.tieneFrase(t, 'eres humano') || this.tieneFrase(t, 'eres persona') || this.tieneFrase(t, 'eres real') ||
      this.tieneFrase(t, 'de donde eres') || this.tieneFrase(t, 'donde vives') ||
      this.tieneFrase(t, 'tienes novia') || this.tieneFrase(t, 'tienes sentimientos') || this.tieneFrase(t, 'tienes sexo') ||
      this.tieneFrase(t, 'que genero eres')
    ) return 'identidad';

    if (
      this.tieneFrase(t, 'eres chatbot') || this.tieneFrase(t, 'eres ia') || this.tieneFrase(t, 'eres asistente') ||
      this.tieneFrase(t, 'puedes conversar') || this.tieneFrase(t, 'puedes platicar') || this.tieneFrase(t, 'aprendes')
    ) return 'chatbot_ia';

    const pideHumano =
      this.match(t, this.HUMANO_KEYWORDS) ||
      (this.match(t, ['humano', 'agente', 'representante', 'operador']) &&
        this.match(t, ['hablar', 'quiero', 'necesito', 'conectame', 'comunicame', 'pasame']));
    if (pideHumano) return 'humano_escalar';

    if (this.tieneFrase(t, 'guardas mis datos') || this.tieneFrase(t, 'almacenas mis datos') || this.tieneFrase(t, 'guardas informacion')) return 'privacidad';
    if (this.tieneFrase(t, 'eres seguro') || this.tieneFrase(t, 'eres segura') || this.tieneFrase(t, 'puedo confiar') || this.tieneFrase(t, 'eres confiable')) return 'confianza';

    if (
      this.tieneFrase(t, 'tu mision') || this.tieneFrase(t, 'tu vision') || this.tieneFrase(t, 'tus valores') ||
      this.tieneFrase(t, 'cual es tu proposito')
    ) return 'identidad_corporativa';

    if (
      this.tieneFrase(t, 'que puedes hacer') || this.tieneFrase(t, 'para que sirves') || this.tieneFrase(t, 'que haces') ||
      this.tieneFrase(t, 'como funcionas') || this.tieneFrase(t, 'puedes ayudarme') || this.tieneFrase(t, 'me ayudas') ||
      this.tieneFrase(t, 'puedes recomendarme') || this.tieneFrase(t, 'me recomiendas') ||
      // JLP-DETECTAR-INTENT-GAP-FIX: responder() ya reconocía estas frases
      // ('me puedes ayudar', 'necesito ayuda') en su propio bloque de
      // capacidades, pero detectarIntent() no las tenía — encontrado por
      // la suite de pruebas (caso "nesesito ayuda"), lo que hacía que la
      // etiqueta de intención guardada en el historial no coincidiera con
      // la respuesta real que el usuario recibía.
      this.tieneFrase(t, 'me puedes ayudar') || this.tieneFrase(t, 'necesito ayuda')
    ) return 'capacidades';

    if (this.match(t, this.PROMO_KEYWORDS)) return 'promociones';
    if (this.match(t, this.PRECIO_KEYWORDS)) return 'precio';
    if (this.match(t, this.AGENDAR_CITA_KEYWORDS)) return 'agendar_cita';

    if (this.tieneFrase(t, 'usas ubicacion') || this.tieneFrase(t, 'cerca de mi') || this.tieneFrase(t, 'negocios cercanos')) return 'ubicacion';

    if (
      this.tieneFrase(t, 'como te pregunto') || this.tieneFrase(t, 'como uso jelpy') ||
      this.tieneFrase(t, 'que le puedo preguntar') || this.tieneFrase(t, 'no se que buscar') ||
      this.tieneFrase(t, 'quiero salir') || this.tieneFrase(t, 'algo para hacer')
    ) return 'guia_uso';

    if (this.tieneFrase(t, 'me escuchas') || this.tieneFrase(t, 'estas ahi') || this.tieneFrase(t, 'me entiendes') || this.tieneFrase(t, 'puedes equivocarte')) return 'presencia';

    // JLP-SALUDO-GAP-FIX: bug real reportado por el usuario — "buenos días"
    // NO se reconocía aquí (solo "buenas" a secas), así que detectarIntent
    // devolvía 'fallback' para un saludo perfectamente normal. Como
    // ConversationClassifier usa este chatIntent para decidir la ruta, un
    // "buenos días" terminaba disparando la pregunta guiada de Capa 2
    // ("¿es comida, salud, belleza o servicio?") en vez de un saludo — la
    // respuesta "muy incoherente" que reportó el usuario. Debe reflejar
    // EXACTAMENTE las mismas frases que el bloque de saludo en responder().
    if (
      this.tieneFrase(t, 'hola') || this.tieneFrase(t, 'buenas') || this.tieneFrase(t, 'hey') ||
      this.tieneFrase(t, 'holi') || this.tieneFrase(t, 'buen dia') || this.tieneFrase(t, 'buenos dias') ||
      this.tieneFrase(t, 'buenas tardes') || this.tieneFrase(t, 'buenas noches') || t === this.normalizar('hi')
    ) return 'saludo';

    if (this.tieneFrase(t, 'gracias')) return 'gracias';
    if (this.tieneFrase(t, 'adios') || this.tieneFrase(t, 'nos vemos') || this.tieneFrase(t, 'hasta luego') || this.tieneFrase(t, 'bye')) return 'despedida';

    if (this.tieneFrase(t, 'que me recomiendas') || this.tieneFrase(t, 'recomiendame algo') || this.tieneFrase(t, 'dame una recomendacion')) return 'recomendacion_general';
    if (this.tieneFrase(t, 'hablas espanol') || this.tieneFrase(t, 'entiendes espanol')) return 'idioma';

    if (this.tieneFrase(t, 'no entiendo') || this.tieneFrase(t, 'repiteme') || this.tieneFrase(t, 'explicame')) return 'no_entiende';

    return 'fallback';
  }

  // =====================================================
  // RESPUESTAS PRINCIPALES
  // =====================================================
  static responder(
    input: string,
    contexto?: { ciudad?: string; historialTurnos?: number; ultimaIntencionChat?: string },
  ) {
    const t = this.normalizar(input);

    const ciudad          = (contexto?.ciudad || '').trim();
    const tieneCiudad     = !!ciudad;
    const tieneHistorial  = (contexto?.historialTurnos ?? 0) > 0;

    const enCiudad   = tieneCiudad ? ` en ${ciudad}` : '';
    const ejemplos   = tieneCiudad
      ? `"farmacia abierta", "tacos cerca de mí", "barbería abierta" o "hotel con alberca"`
      : `"farmacia en Tepic", "tacos cerca de mí", "barbería abierta" o "hotel con alberca"`;

    // --------------------------------------------------
    // 🚫 TEMAS FUERA DE ALCANCE
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'tarea') || this.tieneFrase(t, 'resumen') ||
      this.tieneFrase(t, 'matematica') || this.tieneFrase(t, 'quimica') ||
      this.tieneFrase(t, 'fisica') || this.tieneFrase(t, 'codigo') ||
      this.tieneFrase(t, 'programacion') || this.tieneFrase(t, 'investigacion') ||
      this.tieneFrase(t, 'haz mi tarea') || this.tieneFrase(t, 'escribe un ensayo')
    ) {
      return {
        titulo: 'Soy Jelpy 😉',
        mensaje: this.elegir([
          'Mi especialidad son los negocios, doctores, servicios y promociones en tu ciudad. Para tareas o programación te recomiendo otras herramientas.',
          'Eso está fuera de mi área 😅 Pero puedo ayudarte a encontrar negocios, servicios, doctores o promociones cerca de ti.',
          'No soy la mejor opción para eso, pero sí puedo ayudarte a encontrar lo que necesitas en tu ciudad. ¿Qué buscas?',
        ]),
      };
    }

    // --------------------------------------------------
    // 🟦 ENTRADAS MUY CORTAS (tokens de relleno, no palabras clave)
    // --------------------------------------------------
    if (!this.esSaludoCortoEspecial(t) && (t.length <= 2 || ['aaa','emm','mmm','eh','ok','no se','nop','np'].includes(t))) {
      return {
        titulo: 'Aquí estoy 😊',
        mensaje: tieneCiudad
          ? this.elegir([
              `Dime qué necesitas y busco en ${ciudad}. Por ejemplo: "farmacia abierta", "tacos cerca" o "barbería".`,
              `Cuéntame qué buscas y lo encuentro en ${ciudad}.`,
            ])
          : this.elegir([
              'Dime qué necesitas encontrar. Puedes buscar tacos, farmacias, doctores, barberías y mucho más.',
              'Cuéntame qué buscas y te ayudo a encontrarlo.',
            ]),
      };
    }

    // --------------------------------------------------
    // 😔 QUEJA / USUARIO MOLESTO
    // Se evalúa con alta prioridad (antes que identidad, capacidades, etc.)
    // porque el tono importa más que el contenido cuando el usuario
    // está molesto: nunca debe recibir un emoji alegre o un chiste aquí.
    // --------------------------------------------------
    if (this.match(t, this.QUEJA_KEYWORDS)) {
      return {
        titulo: 'Lamento la mala experiencia 😔',
        mensaje: this.elegir([
          'Cuéntame qué pasó exactamente para poder ayudarte o registrar tu reporte correctamente.',
          '¿Puedes contarme más detalles? Si es sobre un negocio específico, dime cuál para revisarlo.',
          'Entiendo tu molestia. Dime qué ocurrió y con gusto te ayudo a resolverlo o a encontrar otra opción.',
        ]),
      };
    }

    // --------------------------------------------------
    // 🔁 EVITAR REPETIR LA MISMA RESPUESTA INFORMATIVA
    // Si en el turno anterior ya se respondió el mismo tipo de pregunta
    // (identidad, capacidades, guía de uso...), se reconoce en vez de
    // repetir el bloque completo palabra por palabra.
    // --------------------------------------------------
    if (
      contexto?.ultimaIntencionChat &&
      this.INTENTS_REPETIBLES.includes(contexto.ultimaIntencionChat) &&
      this.detectarIntent(input) === contexto.ultimaIntencionChat
    ) {
      return {
        titulo: this.elegir(['Ya te había contado un poco de esto 😊', 'Como te comentaba 💬']),
        mensaje: this.elegir([
          `Creo que ya te respondí algo parecido. ¿Quieres que profundice en algo puntual o mejor buscamos algo${enCiudad}?`,
          `Ya habíamos tocado este tema. Dime si quieres más detalle o si prefieres que busquemos algo${enCiudad}.`,
        ]),
      };
    }

    // --------------------------------------------------
    // IDENTIDAD
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'quien eres') || this.tieneFrase(t, 'que eres') ||
      this.tieneFrase(t, 'quien es jelpy') || this.tieneFrase(t, 'que es jelpy') ||
      this.tieneFrase(t, 'quien sos') || this.tieneFrase(t, 'presentate')
    ) {
      return {
        titulo: this.elegir(['Soy Jelpy 🤖✨', 'Me llamo Jelpy 💙', '¡Hola! Soy Jelpy 😊']),
        mensaje: this.elegir([
          'Soy tu asistente virtual para encontrar negocios, servicios, doctores, promociones y lugares cerca de ti.',
          'Soy Jelpy, un asistente diseñado para ayudarte a descubrir lo mejor de tu ciudad: restaurantes, farmacias, doctores, barberías y mucho más.',
          `Soy un asistente local 📍 Te ayudo a encontrar negocios y servicios${enCiudad}. Solo dime qué necesitas.`,
        ]),
      };
    }

    if (
      this.tieneFrase(t, 'como te llamas') || this.tieneFrase(t, 'cual es tu nombre') ||
      this.tieneFrase(t, 'tu nombre') || this.tieneFrase(t, 'llamas')
    ) {
      return {
        titulo: 'Me llamo Jelpy 💙',
        mensaje: this.elegir([
          `Estoy aquí para ayudarte a encontrar lo que necesites${enCiudad} de forma rápida.`,
          'Jelpy, tu guía local. ¿En qué te puedo ayudar hoy?',
        ]),
      };
    }

    if (
      this.tieneFrase(t, 'eres humano') || this.tieneFrase(t, 'eres persona') ||
      this.tieneFrase(t, 'eres real') || this.tieneFrase(t, 'hablas con alguien')
    ) {
      return {
        titulo: 'Soy un asistente virtual 🤖',
        mensaje: this.elegir([
          'No soy una persona, pero sí puedo ayudarte a encontrar negocios, servicios y promociones en tu ciudad.',
          'Soy IA, pero estoy aquí para ayudarte de verdad 😊 ¿Qué necesitas encontrar?',
        ]),
      };
    }

    if (
      this.tieneFrase(t, 'de donde eres') || this.tieneFrase(t, 'donde vives') ||
      this.tieneFrase(t, 'de donde vienes')
    ) {
      return {
        titulo: 'Vengo de la nube 🌐',
        mensaje: tieneCiudad
          ? this.elegir([
              `Vivo en internet pero trabajo contigo. Ahora mismo puedo ayudarte a buscar en ${ciudad}.`,
              `No tengo una ciudad propia, pero puedo enfocarme en ${ciudad} para ayudarte mejor.`,
            ])
          : this.elegir([
              'Existo en internet, pero me adapto a tu ciudad para ayudarte mejor. ¿Dónde quieres buscar?',
              'Vivo en la nube ☁️ Dime tu ciudad y ajusto mis búsquedas.',
            ]),
      };
    }

    if (
      this.tieneFrase(t, 'tienes novia') || this.tieneFrase(t, 'tienes novio') ||
      this.tieneFrase(t, 'estas enamorado') || this.tieneFrase(t, 'tienes sentimientos') ||
      this.tieneFrase(t, 'sientes algo') || this.tieneFrase(t, 'te gusta alguien')
    ) {
      return {
        titulo: 'Soy un asistente virtual 😅',
        mensaje: this.elegir([
          'No tengo sentimientos, pero sí tengo ganas de ayudarte a encontrar lo que buscas. ¿Qué necesitas?',
          'No siento ni me enamoro, pero sí resuelvo búsquedas rápido 😄 ¿Qué buscas?',
        ]),
      };
    }

    if (
      this.tieneFrase(t, 'tienes sexo') || this.tieneFrase(t, 'que genero eres') ||
      this.tieneFrase(t, 'eres hombre') || this.tieneFrase(t, 'eres mujer')
    ) {
      return {
        titulo: 'Soy Jelpy 🤖',
        mensaje: this.elegir([
          'Soy solo software y hablo de mí en masculino, pero estoy aquí para ayudarte con negocios, servicios y más.',
          'Me refiero a mí mismo en masculino, aunque en el fondo solo soy código 😊 ¿En qué te ayudo?',
        ]),
      };
    }

    // --------------------------------------------------
    // CONVERSACIÓN / CHATBOT / IA
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'eres chatbot') || this.tieneFrase(t, 'eres ia') ||
      this.tieneFrase(t, 'eres inteligencia artificial') || this.tieneFrase(t, 'eres asistente') ||
      this.tieneFrase(t, 'eres como chatgpt') || this.tieneFrase(t, 'eres como siri') ||
      this.tieneFrase(t, 'puedes conversar') || this.tieneFrase(t, 'puedes platicar')
    ) {
      return {
        titulo: 'Sí, puedo conversar 💬',
        mensaje: this.elegir([
          'Puedo responder preguntas y charlar un poco, pero mi fuerte es ayudarte a encontrar negocios, doctores, servicios y promociones cerca de ti.',
          `Soy un asistente conversacional enfocado en negocios locales${enCiudad}. Pregúntame lo que necesites.`,
        ]),
      };
    }

    if (this.tieneFrase(t, 'aprendes') || this.tieneFrase(t, 'puedes aprender') || this.tieneFrase(t, 'aprendes de mi')) {
      return {
        titulo: 'Me adapto a ti 📚',
        mensaje: tieneCiudad
          ? this.elegir([
              `Aprendo de tus búsquedas y preferencias para darte mejores resultados en ${ciudad}.`,
              `Con cada búsqueda entiendo mejor lo que te interesa en ${ciudad}.`,
            ])
          : this.elegir([
              'Aprendo de tus búsquedas para darte respuestas más útiles con el tiempo.',
              'Entre más me uses, mejor te entiendo. Así de simple.',
            ]),
      };
    }

    // --------------------------------------------------
    // ESCALAR A HUMANO
    // --------------------------------------------------
    const pideHumano =
      this.match(t, this.HUMANO_KEYWORDS) ||
      (this.match(t, ['humano', 'agente', 'representante', 'operador']) &&
        this.match(t, ['hablar', 'quiero', 'necesito', 'conectame', 'comunicame', 'pasame']));

    if (pideHumano) {
      return {
        titulo: 'Entiendo 🙋',
        mensaje: this.elegir([
          'Por ahora soy un asistente virtual y no tengo forma de transferirte con una persona desde aquí, pero puedes contactar a soporte desde la sección de ayuda de la app. Mientras tanto, cuéntame qué necesitas y hago mi mejor esfuerzo.',
          'No puedo transferirte a un agente humano en este momento, pero puedo intentar resolver tu duda. Si prefieres, busca la opción de soporte dentro de la app. ¿Qué necesitas?',
        ]),
      };
    }

    if (
      this.tieneFrase(t, 'guardas mis datos') || this.tieneFrase(t, 'almacenas mis datos') ||
      this.tieneFrase(t, 'te acuerdas de mi') || this.tieneFrase(t, 'guardas informacion')
    ) {
      return {
        titulo: 'Tu privacidad importa 🔐',
        mensaje: this.elegir([
          'Guardo el contexto de tu conversación para darte mejores resultados, pero no compartimos tu información personal.',
          'Uso el historial de la sesión solo para entenderte mejor. Tu información no se comparte con terceros.',
        ]),
      };
    }

    if (this.tieneFrase(t, 'eres seguro') || this.tieneFrase(t, 'eres segura') || this.tieneFrase(t, 'puedo confiar') || this.tieneFrase(t, 'eres confiable')) {
      return {
        titulo: 'Puedes confiar en mí 🤝',
        mensaje: this.elegir([
          'Estoy diseñado para ayudarte de forma clara, amable y útil. ¿En qué te puedo ayudar?',
          'Trabajo con información verificada de negocios reales. ¿Qué necesitas encontrar?',
        ]),
      };
    }

    // --------------------------------------------------
    // MISIÓN / VISIÓN / VALORES
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'tu mision') || this.tieneFrase(t, 'mision de jelpy') ||
      this.tieneFrase(t, 'para que existes') || this.tieneFrase(t, 'cual es tu proposito')
    ) {
      return {
        titulo: 'Mi misión 🎯',
        mensaje: this.elegir([
          'Conectar a las personas con los mejores negocios, servicios y lugares de su ciudad de forma rápida, sencilla y confiable.',
          'Ayudarte a encontrar justo lo que necesitas en tu ciudad, sin complicaciones.',
        ]),
      };
    }

    if (this.tieneFrase(t, 'tu vision') || this.tieneFrase(t, 'vision de jelpy')) {
      return {
        titulo: 'Mi visión 🌟',
        mensaje: this.elegir([
          'Ser el asistente local más útil de México: que encontrar algo en tu ciudad sea tan fácil como preguntarle a un amigo.',
          'Que cada persona encuentre lo que busca cerca de casa, sin perder tiempo buscando en varios lados.',
        ]),
      };
    }

    if (this.tieneFrase(t, 'tus valores') || this.tieneFrase(t, 'valores de jelpy')) {
      return {
        titulo: 'Mis valores 💙',
        mensaje: this.elegir([
          'Claridad, cercanía, honestidad y utilidad. Quiero que cada búsqueda sea rápida y que encuentres exactamente lo que necesitas.',
          'Ser útil, claro y honesto en cada respuesta, sin hacerte perder el tiempo.',
        ]),
      };
    }

    // --------------------------------------------------
    // CAPACIDADES
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'que puedes hacer') || this.tieneFrase(t, 'para que sirves') ||
      this.tieneFrase(t, 'que haces') || this.tieneFrase(t, 'como funcionas') ||
      this.tieneFrase(t, 'cuales son tus funciones')
    ) {
      return {
        titulo: 'Puedo ayudarte con mucho 🧠',
        mensaje: tieneCiudad
          ? this.elegir([
              `Busco restaurantes, doctores, farmacias, barberías, tiendas, hoteles, servicios, promociones y más en ${ciudad}. Solo dime qué necesitas.`,
              `Encuentro negocios, servicios y promociones en ${ciudad}. Dime qué te interesa y empezamos.`,
            ])
          : this.elegir([
              'Busco negocios, doctores, servicios, promociones y lugares según tu ciudad o ubicación. También puedo responder dudas sobre los resultados.',
              'Encuentro restaurantes, doctores, farmacias, servicios y promociones cerca de ti. Solo dime qué buscas y en qué ciudad.',
            ]),
      };
    }

    if (
      this.tieneFrase(t, 'puedes ayudarme') || this.tieneFrase(t, 'me ayudas') ||
      this.tieneFrase(t, 'me puedes ayudar') || this.tieneFrase(t, 'necesito ayuda')
    ) {
      return {
        titulo: this.elegir(['¡Claro! 💙', 'Con mucho gusto 😊', 'Sí, dime 🙌']),
        mensaje: tieneCiudad
          ? this.elegir([
              `Dime qué buscas y lo encuentro en ${ciudad}.`,
              `Cuéntame qué necesitas y te ayudo a encontrarlo en ${ciudad}.`,
            ])
          : this.elegir([
              'Dime qué necesitas. Si me dices tu ciudad, los resultados serán más precisos.',
              'Cuéntame qué buscas: comida, salud, servicios, promociones...',
            ]),
      };
    }

    if (
      this.tieneFrase(t, 'puedes recomendarme') || this.tieneFrase(t, 'me recomiendas') ||
      this.tieneFrase(t, 'que recomiendas') || this.tieneFrase(t, 'que me sugieres')
    ) {
      return {
        titulo: this.elegir(['Claro ✨', 'Con gusto 🌟', 'Puedo orientarte 😊']),
        mensaje: tieneCiudad
          ? this.elegir([
              `Puedo recomendarte según lo que busques en ${ciudad}. ¿Qué tipo de lugar te interesa?`,
              `Dime qué se te antoja o qué necesitas y te doy opciones en ${ciudad}.`,
            ])
          : this.elegir([
              'Dime qué categoría te interesa y te oriento: comida, salud, servicios, mascotas, turismo…',
              'Cuéntame qué buscas y te doy opciones cercanas a ti.',
            ]),
      };
    }

    // --------------------------------------------------
    // PROMOCIONES / OFERTAS
    // (match por palabra suelta: promo, promos, oferta, descuento...
    //  no solo frases completas, para evitar el bug de "no reconoce
    //  variantes cortas o sueltas de la palabra")
    // --------------------------------------------------
    if (this.match(t, this.PROMO_KEYWORDS)) {
      return {
        titulo: this.elegir(['¡Sí, busco promociones! 🎉', 'Encuentro ofertas por ti 🎉']),
        mensaje: tieneCiudad
          ? this.elegir([
              `Puedo buscar promociones en ${ciudad}. Dime en qué categoría: sushi, barbería, hotel, farmacia…`,
              `Dime qué tipo de negocio te interesa y busco las promociones en ${ciudad}.`,
            ])
          : this.elegir([
              'Dime qué tipo de negocio y tu ciudad, y busco las mejores promociones disponibles.',
              '¿Promociones de qué tipo: comida, belleza, salud? Dime también tu ciudad para afinar la búsqueda.',
            ]),
      };
    }

    // --------------------------------------------------
    // PRECIOS / COSTOS
    // --------------------------------------------------
    if (this.match(t, this.PRECIO_KEYWORDS)) {
      return {
        titulo: 'Sobre precios 💰',
        mensaje: this.elegir([
          'No fijo precios propios, pero te muestro negocios en tu ciudad para que compares directamente en sus perfiles. ¿Qué buscas?',
          tieneCiudad
            ? `Los precios varían por negocio. Dime qué buscas en ${ciudad} y te muestro opciones con su información.`
            : 'Los precios varían por negocio. Dime qué buscas y en qué ciudad, y te muestro opciones para comparar.',
        ]),
      };
    }

    // --------------------------------------------------
    // AGENDAR CITA / RESERVAR
    // --------------------------------------------------
    if (this.match(t, this.AGENDAR_CITA_KEYWORDS)) {
      return {
        titulo: 'Te ayudo a encontrar dónde agendar 🗓️',
        mensaje: this.elegir([
          'Puedo ayudarte a encontrar el negocio; la cita se agenda directamente con ellos (por teléfono o desde su perfil). ¿Con quién o para qué servicio te gustaría agendar?',
          tieneCiudad
            ? `Dime el negocio o servicio (doctor, spa, barbería...) y te muestro opciones en ${ciudad} para que agendes directo con ellos.`
            : 'Dime el negocio o servicio (doctor, spa, barbería...) y tu ciudad, y te muestro opciones para agendar directo con ellos.',
        ]),
      };
    }

    if (
      this.tieneFrase(t, 'usas ubicacion') || this.tieneFrase(t, 'puedes buscar cerca') ||
      this.tieneFrase(t, 'cerca de mi') || this.tieneFrase(t, 'negocios cercanos')
    ) {
      return {
        titulo: 'Sí, busco por cercanía 📍',
        mensaje: tieneCiudad
          ? this.elegir([
              `Con tu ubicación o usando ${ciudad} como referencia, puedo mostrarte opciones cercanas.`,
              `Puedo priorizar lo más cercano a ti dentro de ${ciudad}.`,
            ])
          : this.elegir([
              'Si me compartes tu ubicación o ciudad, puedo ayudarte a encontrar lugares cercanos.',
              'Dime tu ciudad o activa tu ubicación y te muestro lo más cercano.',
            ]),
      };
    }

    // --------------------------------------------------
    // GUÍA DE USO
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'como te pregunto') || this.tieneFrase(t, 'como debo buscar') ||
      this.tieneFrase(t, 'como uso jelpy') || this.tieneFrase(t, 'como buscar contigo')
    ) {
      return {
        titulo: 'Es muy fácil 🙌',
        mensaje: tieneCiudad
          ? this.elegir([
              `Escríbeme algo como: "farmacia abierta", "tacos cerca de mí" o "doctor general". Usaré ${ciudad} como referencia.`,
              `Solo dime qué buscas, por ejemplo "barbería abierta" o "promociones de sushi", y busco en ${ciudad}.`,
            ])
          : this.elegir([
              'Escríbeme algo como: "farmacia en Tepic", "tacos cerca de mí" o "barbería abierta". Así de fácil.',
              'Dime qué necesitas en lenguaje natural, como le pedirías a un amigo. Yo entiendo el resto.',
            ]),
      };
    }

    if (
      this.tieneFrase(t, 'que le puedo preguntar') || this.tieneFrase(t, 'que puedo preguntarte') ||
      this.tieneFrase(t, 'que tipos de cosas') || this.tieneFrase(t, 'que mas puedes')
    ) {
      return {
        titulo: 'Puedes preguntarme muchas cosas ✨',
        mensaje: tieneCiudad
          ? this.elegir([
              `Comida, doctores, negocios, servicios, promociones, hoteles, veterinarias, barberías y más en ${ciudad}.`,
              `Cualquier negocio, servicio o promoción que necesites en ${ciudad}. ¡Pruébame!`,
            ])
          : this.elegir([
              'Comida, doctores, negocios, servicios, promociones, hoteles, veterinarias, barberías y más. ¡Inténtalo!',
              'Desde un antojo hasta una urgencia médica: pregúntame y busco la mejor opción.',
            ]),
      };
    }

    if (
      this.tieneFrase(t, 'no se que buscar') || this.tieneFrase(t, 'ayudame a decidir') ||
      this.tieneFrase(t, 'no sé que quiero') || this.tieneFrase(t, 'dame ideas')
    ) {
      return {
        titulo: 'Te ayudo a decidir 🧭',
        mensaje: `¿Qué categoría te llama más${enCiudad}? 🍔 Comida | 🏥 Salud | 🔧 Servicios | 🐶 Mascotas | ✨ Belleza | 🌴 Turismo`,
      };
    }

    if (
      this.tieneFrase(t, 'quiero salir') || this.tieneFrase(t, 'algo para hacer') ||
      this.tieneFrase(t, 'a donde puedo ir') || this.tieneFrase(t, 'planes para hoy')
    ) {
      return {
        titulo: 'Tengo ideas para ti 🎉',
        mensaje: tieneCiudad
          ? this.elegir([
              `Puedo ayudarte a encontrar bares, restaurantes, karaokes, parques o turismo en ${ciudad}. ¿Qué te late más?`,
              `¿Antojo de salir? Busco bares, restaurantes o planes de turismo en ${ciudad}.`,
            ])
          : this.elegir([
              'Puedo ayudarte a encontrar bares, restaurantes, karaokes, parques o turismo. ¿En qué ciudad estás?',
              '¿Qué se te antoja: comer, tomar algo, turismo? Dime tu ciudad y busco opciones.',
            ]),
      };
    }

    // --------------------------------------------------
    // PRESENCIA / DISPONIBILIDAD
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'me escuchas') || this.tieneFrase(t, 'me lees') ||
      this.tieneFrase(t, 'estas ahi') || this.tieneFrase(t, 'sigues ahi') ||
      this.tieneFrase(t, 'estas activo') || this.tieneFrase(t, 'estas activa') || this.tieneFrase(t, 'estas disponible')
    ) {
      return {
        titulo: this.elegir(['Sí, aquí estoy 👀', 'Sigo aquí 💙', 'Claro, te leo 😊']),
        mensaje: tieneHistorial
          ? this.elegir([
              'Sigo aquí. ¿Quieres continuar con lo que buscabas o necesitas algo diferente?',
              'Presente. ¿Seguimos con la búsqueda anterior o algo nuevo?',
            ])
          : this.elegir([
              'Estoy listo para ayudarte. Dime qué necesitas.',
              'Aquí estoy, listo para tu siguiente búsqueda.',
            ]),
      };
    }

    if (this.tieneFrase(t, 'me entiendes') || this.tieneFrase(t, 'entiendes lo que digo')) {
      return {
        titulo: 'Sí, haré mi mejor esfuerzo 💬',
        mensaje: this.elegir([
          'Entiendo muchas búsquedas aunque tengan faltas o estén escritas de forma informal.',
          'Intento entenderte aunque escribas rápido o con algunas faltas. Si algo no queda claro, dímelo.',
        ]),
      };
    }

    if (this.tieneFrase(t, 'puedes equivocarte') || this.tieneFrase(t, 'te equivocas') || this.tieneFrase(t, 'a veces fallas')) {
      return {
        titulo: 'Puedo mejorar contigo 🛠️',
        mensaje: tieneCiudad
          ? this.elegir([
              `A veces necesito más contexto. Si me das más detalle, puedo ser más preciso en ${ciudad}.`,
              'Puedo equivocarme si el mensaje es muy ambiguo. Dame un poco más de detalle y te ayudo mejor.',
            ])
          : this.elegir([
              'A veces necesito más detalle para darte resultados exactos. No dudes en reformular si algo no está bien.',
              'Puedo fallar si el mensaje es muy corto o ambiguo. Dame más contexto y mejoro la respuesta.',
            ]),
      };
    }

    // --------------------------------------------------
    // SALUDOS
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'hola') || this.tieneFrase(t, 'buenas') || this.tieneFrase(t, 'hey') ||
      this.tieneFrase(t, 'holi') || this.tieneFrase(t, 'buen dia') || this.tieneFrase(t, 'buenos dias') ||
      this.tieneFrase(t, 'buenas tardes') || this.tieneFrase(t, 'buenas noches') || t === this.normalizar('hi')
    ) {
      // JLP-SALUDO-COHERENTE-FIX: antes el título SIEMPRE se calculaba con
      // la hora del servidor (this.saludoPorHora()), sin importar lo que
      // el usuario realmente escribió — por eso alguien podía escribir
      // "buenas tardes" y recibir un título de "Buenos días" si el reloj
      // del servidor marcaba otra franja, algo incoherente (bug reportado
      // por el usuario). Ahora, si fue específico, Jelpy responde con
      // exactamente esa franja horaria; solo recurre a la hora del
      // servidor cuando el saludo es genérico ("hola", "buenas", "hey"...).
      const franjaDetectada: 'dias' | 'tardes' | 'noches' | null =
        this.tieneFrase(t, 'buenos dias') || this.tieneFrase(t, 'buen dia')
          ? 'dias'
          : this.tieneFrase(t, 'buenas tardes')
            ? 'tardes'
            : this.tieneFrase(t, 'buenas noches')
              ? 'noches'
              : null;

      const saludo =
        franjaDetectada === 'dias' ? 'Buenos días'
        : franjaDetectada === 'tardes' ? 'Buenas tardes'
        : franjaDetectada === 'noches' ? 'Buenas noches'
        : this.saludoPorHora();

      const emoji = this.emojiSaludo();

      // Más calidez y variedad conversacional (pedido explícito del
      // usuario): en vez de repetir siempre "¿qué te gustaría encontrar?",
      // se agregan toques de charla ("¿cómo estás?", "qué gusto verte")
      // antes de guiar hacia la búsqueda.
      //
      // JLP-SALUDO-COHERENTE-FIX (parte 2): cuando el usuario fue específico
      // sobre la franja horaria (franjaDetectada !== null), el título SIEMPRE
      // debe reflejarla — sortear el título entre opciones que no la
      // mencionan (ej. "¡Qué gusto verte!") reintroduciría el mismo tipo de
      // incoherencia que este fix resuelve. La variedad de título solo
      // aplica cuando el saludo fue genérico ("hola", "buenas", "hey"...).
      return {
        titulo:
          tieneHistorial || franjaDetectada
            ? `${saludo} ${emoji}`
            : this.elegir([`${saludo} ${emoji}`, `¡Qué gusto verte! ${emoji}`, `${saludo}, bienvenido ${emoji}`]),
        mensaje: tieneHistorial
          ? this.elegir([
              `Qué gusto verte de nuevo. ¿En qué más te puedo ayudar${enCiudad}?`,
              `Aquí sigo. ¿Seguimos con lo que buscabas o necesitas algo diferente${enCiudad}?`,
              `¿Cómo vas? Cuéntame qué necesitas ahora y lo buscamos${enCiudad}.`,
              `Sigo por aquí para lo que se ofrezca. ¿Qué más te ayudo a encontrar${enCiudad}?`,
            ])
          : this.elegir(
              tieneCiudad
                ? [
                    `¡Qué gusto saludarte! 😊 ¿Cómo estás? Cuéntame qué se te antoja o qué necesitas en ${ciudad} y te ayudo a encontrarlo.`,
                    `${saludo}, bienvenido a Jelpy 💙 Dime qué buscas y lo encuentro en ${ciudad}.`,
                    `Un gusto tenerte por aquí 🙌 ¿Qué tal tu día? Cuéntame qué te gustaría encontrar en ${ciudad}: comida, salud, servicios, promociones...`,
                    `${saludo} 😊 Espero que la estés pasando bien. ¿Qué necesitas encontrar hoy en ${ciudad}?`,
                  ]
                : [
                    '¡Qué gusto saludarte! 😊 ¿Cómo estás? Cuéntame qué necesitas y te ayudo a encontrarlo cerca de ti.',
                    `${saludo}, bienvenido a Jelpy 💙 Dime qué buscas: comida, salud, servicios, promociones...`,
                    'Un gusto tenerte por aquí 🙌 ¿Qué tal tu día? Estoy para ayudarte a encontrar lo que necesites.',
                    `${saludo} 😊 Espero que la estés pasando bien. ¿Qué te gustaría encontrar hoy?`,
                  ],
            ),
      };
    }

    // --------------------------------------------------
    // GRACIAS / DESPEDIDA
    // --------------------------------------------------
    if (this.tieneFrase(t, 'gracias') || this.tieneFrase(t, 'te agradezco') || this.tieneFrase(t, 'muchas gracias')) {
      return {
        titulo: this.elegir(['¡Con gusto! 💙', '¡Para eso estoy! 😊', 'Un placer 🙌']),
        mensaje: tieneCiudad
          ? this.elegir([
              `Cuando quieras volver a buscar algo en ${ciudad} o en otra ciudad, aquí estaré.`,
              `Aquí estaré si necesitas buscar algo más en ${ciudad}.`,
            ])
          : this.elegir([
              'Estoy aquí siempre que me necesites.',
              'Cuando quieras buscar algo más, aquí estaré.',
            ]),
      };
    }

    if (
      this.tieneFrase(t, 'adios') || this.tieneFrase(t, 'nos vemos') || this.tieneFrase(t, 'hasta luego') ||
      this.tieneFrase(t, 'bye') || this.tieneFrase(t, 'chao') || this.tieneFrase(t, 'hasta pronto')
    ) {
      return {
        titulo: this.elegir(['¡Hasta luego! 👋', '¡Nos vemos! 👋', 'Cuídate 💙']),
        mensaje: this.elegir([
          'Cuando quieras volver a buscar algo, aquí estaré.',
          '¡Que te vaya bien! Si necesitas algo más, ya sabes dónde encontrarme.',
        ]),
      };
    }

    // --------------------------------------------------
    // RECOMENDACIONES GENERALES
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'que me recomiendas') || this.tieneFrase(t, 'recomiendame algo') ||
      this.tieneFrase(t, 'sugiereme algo') || this.tieneFrase(t, 'dame una recomendacion') ||
      this.tieneFrase(t, 'quiero una recomendacion')
    ) {
      return {
        titulo: 'Te ayudo a decidir ✨',
        mensaje: tieneHistorial
          ? `Basado en lo que has buscado, puedo orientarte mejor. ¿Qué tipo de lugar te interesa ahora${enCiudad}?`
          : `Dime qué tipo de lugar te interesa: comida, salud, servicios, belleza o turismo${enCiudad}.`,
      };
    }

    // --------------------------------------------------
    // HABLAR EN ESPAÑOL
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'hablas espanol') || this.tieneFrase(t, 'entiendes espanol') ||
      this.tieneFrase(t, 'solo espanol') || this.tieneFrase(t, 'solo hablas espanol')
    ) {
      return {
        titulo: 'Sí, en español 🇲🇽',
        mensaje: this.elegir([
          'Entiendo español, incluyendo escritura informal y algunas faltas de ortografía. ¿En qué te puedo ayudar?',
          'Español es mi idioma principal, incluso si escribes informal. ¿Qué necesitas?',
        ]),
      };
    }

    // --------------------------------------------------
    // 🟨 USUARIO CONFUNDIDO (catch-all inteligente)
    // Se evalúa AQUÍ (casi al final) y no al principio, para que un
    // mensaje como "no entiendo cómo buscar promociones" resuelva
    // primero por el tema mencionado (promociones) y no quede
    // atrapado en una respuesta genérica de "no entendí".
    // --------------------------------------------------
    if (
      this.tieneFrase(t, 'no entiendo') || this.tieneFrase(t, 'repiteme') ||
      this.tieneFrase(t, 'explicame') || this.tieneFrase(t, 'como funciona esto')
    ) {
      return {
        titulo: 'Claro, te explico ✨',
        mensaje: tieneCiudad
          ? this.elegir([
              `Solo escríbeme qué buscas y yo lo encuentro en ${ciudad}. Por ejemplo: "tacos", "farmacia abierta" o "doctor general".`,
              `Dime qué necesitas (comida, salud, servicios, promociones...) y busco en ${ciudad}.`,
            ])
          : this.elegir([
              'Solo escríbeme qué buscas: comida, salud, servicios, mascotas, turismo… y yo lo encuentro. Si me dices tu ciudad, los resultados son más precisos.',
              'Dime qué necesitas en pocas palabras y yo me encargo de buscarlo.',
            ]),
      };
    }

    // --------------------------------------------------
    // SI NO ENCONTRÉ COINCIDENCIA → DEFAULT DINÁMICO
    // --------------------------------------------------
    return {
      titulo: tieneHistorial ? '¿Quieres buscar algo más? 🔍' : 'Estoy aquí para ayudarte 💙',
      mensaje: tieneCiudad
        ? `No entendí bien, pero puedo ayudarte a buscar en ${ciudad}. Por ejemplo: ${ejemplos}.`
        : `No entendí bien, pero puedo ayudarte. Prueba algo como: ${ejemplos}.`,
    };
  }
}
