export class ChatResponses {

  // =====================================================
  // UTILIDADES
  // =====================================================

  static normalizar(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s¿?¡!]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/kien|qien|kin/g, 'quien')
      .replace(/kual|qual/g, 'cual')
      .replace(/komo/g, 'como')
      .replace(/yamas|llamaz|yamaz/g, 'llamas')
      .replace(/\bke\b/g, 'que')
      .replace(/\bnose\b/g, 'no se')
      .replace(/\bpa\b/g, 'para')
      .replace(/\bxfa\b/g, 'por favor')
      .replace(/\bporfa\b/g, 'por favor')
      .trim();
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
      const escapada = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      t.includes('tarea') || t.includes('resumen') || t.includes('matematica') ||
      t.includes('quimica') || t.includes('fisica') || t.includes('codigo') ||
      t.includes('programacion') || t.includes('investigacion')
    ) return 'fuera_de_alcance';

    if (t.length <= 2 || ['aaa','emm','mmm','eh','ok','no se','nop','np'].includes(t)) return 'confuso';

    if (this.match(t, this.QUEJA_KEYWORDS)) return 'queja';

    if (
      t.includes('quien eres') || t.includes('que eres') || t.includes('como te llamas') ||
      t.includes('cual es tu nombre') || t.includes('tu nombre') || t.includes('llamas') ||
      t.includes('eres humano') || t.includes('eres persona') || t.includes('eres real') ||
      t.includes('de donde eres') || t.includes('donde vives') ||
      t.includes('tienes novia') || t.includes('tienes sentimientos') || t.includes('tienes sexo') ||
      t.includes('que genero eres')
    ) return 'identidad';

    if (
      t.includes('eres chatbot') || t.includes('eres ia') || t.includes('eres asistente') ||
      t.includes('puedes conversar') || t.includes('puedes platicar') || t.includes('aprendes')
    ) return 'chatbot_ia';

    const pideHumano =
      this.match(t, this.HUMANO_KEYWORDS) ||
      (this.match(t, ['humano', 'agente', 'representante', 'operador']) &&
        this.match(t, ['hablar', 'quiero', 'necesito', 'conectame', 'comunicame', 'pasame']));
    if (pideHumano) return 'humano_escalar';

    if (t.includes('guardas mis datos') || t.includes('almacenas mis datos') || t.includes('guardas informacion')) return 'privacidad';
    if (t.includes('eres segura') || t.includes('puedo confiar') || t.includes('eres confiable')) return 'confianza';

    if (
      t.includes('tu mision') || t.includes('tu vision') || t.includes('tus valores') ||
      t.includes('cual es tu proposito')
    ) return 'identidad_corporativa';

    if (
      t.includes('que puedes hacer') || t.includes('para que sirves') || t.includes('que haces') ||
      t.includes('como funcionas') || t.includes('puedes ayudarme') || t.includes('me ayudas') ||
      t.includes('puedes recomendarme') || t.includes('me recomiendas')
    ) return 'capacidades';

    if (this.match(t, this.PROMO_KEYWORDS)) return 'promociones';
    if (this.match(t, this.PRECIO_KEYWORDS)) return 'precio';
    if (this.match(t, this.AGENDAR_CITA_KEYWORDS)) return 'agendar_cita';

    if (t.includes('usas ubicacion') || t.includes('cerca de mi') || t.includes('negocios cercanos')) return 'ubicacion';

    if (
      t.includes('como te pregunto') || t.includes('como uso jelpy') ||
      t.includes('que le puedo preguntar') || t.includes('no se que buscar') ||
      t.includes('quiero salir') || t.includes('algo para hacer')
    ) return 'guia_uso';

    if (t.includes('me escuchas') || t.includes('estas ahi') || t.includes('me entiendes') || t.includes('puedes equivocarte')) return 'presencia';

    if (
      t.includes('hola') || t.includes('buenas') || t.includes('hey') || t.includes('holi') || t === 'hi'
    ) return 'saludo';

    if (t.includes('gracias')) return 'gracias';
    if (t.includes('adios') || t.includes('nos vemos') || t.includes('hasta luego') || t.includes('bye')) return 'despedida';

    if (t.includes('que me recomiendas') || t.includes('recomiendame algo') || t.includes('dame una recomendacion')) return 'recomendacion_general';
    if (t.includes('hablas espanol') || t.includes('entiendes espanol')) return 'idioma';

    if (t.includes('no entiendo') || t.includes('repiteme') || t.includes('explicame')) return 'no_entiende';

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
      t.includes('tarea') || t.includes('resumen') ||
      t.includes('matematica') || t.includes('quimica') ||
      t.includes('fisica') || t.includes('codigo') ||
      t.includes('programacion') || t.includes('investigacion') ||
      t.includes('haz mi tarea') || t.includes('escribe un ensayo')
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
    if (t.length <= 2 || ['aaa','emm','mmm','eh','ok','no se','nop','np'].includes(t)) {
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
      t.includes('quien eres') || t.includes('que eres') ||
      t.includes('quien es jelpy') || t.includes('que es jelpy') ||
      t.includes('quien sos') || t.includes('presentate')
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
      t.includes('como te llamas') || t.includes('cual es tu nombre') ||
      t.includes('tu nombre') || t.includes('llamas')
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
      t.includes('eres humano') || t.includes('eres persona') ||
      t.includes('eres real') || t.includes('hablas con alguien')
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
      t.includes('de donde eres') || t.includes('donde vives') ||
      t.includes('de donde vienes')
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
      t.includes('tienes novia') || t.includes('tienes novio') ||
      t.includes('estas enamorado') || t.includes('tienes sentimientos') ||
      t.includes('sientes algo') || t.includes('te gusta alguien')
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
      t.includes('tienes sexo') || t.includes('que genero eres') ||
      t.includes('eres hombre') || t.includes('eres mujer')
    ) {
      return {
        titulo: 'Soy un asistente sin género 🤖',
        mensaje: this.elegir([
          'Soy solo software, pero estoy aquí para ayudarte con negocios, servicios y más.',
          'No tengo género, soy código 😊 ¿En qué te ayudo?',
        ]),
      };
    }

    // --------------------------------------------------
    // CONVERSACIÓN / CHATBOT / IA
    // --------------------------------------------------
    if (
      t.includes('eres chatbot') || t.includes('eres ia') ||
      t.includes('eres inteligencia artificial') || t.includes('eres asistente') ||
      t.includes('eres como chatgpt') || t.includes('eres como siri') ||
      t.includes('puedes conversar') || t.includes('puedes platicar')
    ) {
      return {
        titulo: 'Sí, puedo conversar 💬',
        mensaje: this.elegir([
          'Puedo responder preguntas y charlar un poco, pero mi fuerte es ayudarte a encontrar negocios, doctores, servicios y promociones cerca de ti.',
          `Soy un asistente conversacional enfocado en negocios locales${enCiudad}. Pregúntame lo que necesites.`,
        ]),
      };
    }

    if (t.includes('aprendes') || t.includes('puedes aprender') || t.includes('aprendes de mi')) {
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
      t.includes('guardas mis datos') || t.includes('almacenas mis datos') ||
      t.includes('te acuerdas de mi') || t.includes('guardas informacion')
    ) {
      return {
        titulo: 'Tu privacidad importa 🔐',
        mensaje: this.elegir([
          'Guardo el contexto de tu conversación para darte mejores resultados, pero no compartimos tu información personal.',
          'Uso el historial de la sesión solo para entenderte mejor. Tu información no se comparte con terceros.',
        ]),
      };
    }

    if (t.includes('eres segura') || t.includes('puedo confiar') || t.includes('eres confiable')) {
      return {
        titulo: 'Puedes confiar en mí 🤝',
        mensaje: this.elegir([
          'Estoy diseñada para ayudarte de forma clara, amable y útil. ¿En qué te puedo ayudar?',
          'Trabajo con información verificada de negocios reales. ¿Qué necesitas encontrar?',
        ]),
      };
    }

    // --------------------------------------------------
    // MISIÓN / VISIÓN / VALORES
    // --------------------------------------------------
    if (
      t.includes('tu mision') || t.includes('mision de jelpy') ||
      t.includes('para que existes') || t.includes('cual es tu proposito')
    ) {
      return {
        titulo: 'Mi misión 🎯',
        mensaje: this.elegir([
          'Conectar a las personas con los mejores negocios, servicios y lugares de su ciudad de forma rápida, sencilla y confiable.',
          'Ayudarte a encontrar justo lo que necesitas en tu ciudad, sin complicaciones.',
        ]),
      };
    }

    if (t.includes('tu vision') || t.includes('vision de jelpy')) {
      return {
        titulo: 'Mi visión 🌟',
        mensaje: this.elegir([
          'Ser el asistente local más útil de México: que encontrar algo en tu ciudad sea tan fácil como preguntarle a un amigo.',
          'Que cada persona encuentre lo que busca cerca de casa, sin perder tiempo buscando en varios lados.',
        ]),
      };
    }

    if (t.includes('tus valores') || t.includes('valores de jelpy')) {
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
      t.includes('que puedes hacer') || t.includes('para que sirves') ||
      t.includes('que haces') || t.includes('como funcionas') ||
      t.includes('cuales son tus funciones')
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
      t.includes('puedes ayudarme') || t.includes('me ayudas') ||
      t.includes('me puedes ayudar') || t.includes('necesito ayuda')
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
      t.includes('puedes recomendarme') || t.includes('me recomiendas') ||
      t.includes('que recomiendas') || t.includes('que me sugieres')
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
              `Puedo buscar promociones activas en ${ciudad}. Dime en qué categoría: sushi, barbería, hotel, farmacia…`,
              `Dime qué tipo de negocio te interesa y busco las promociones activas en ${ciudad}.`,
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
      t.includes('usas ubicacion') || t.includes('puedes buscar cerca') ||
      t.includes('cerca de mi') || t.includes('negocios cercanos')
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
      t.includes('como te pregunto') || t.includes('como debo buscar') ||
      t.includes('como uso jelpy') || t.includes('como buscar contigo')
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
      t.includes('que le puedo preguntar') || t.includes('que puedo preguntarte') ||
      t.includes('que tipos de cosas') || t.includes('que mas puedes')
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
      t.includes('no se que buscar') || t.includes('ayudame a decidir') ||
      t.includes('no sé que quiero') || t.includes('dame ideas')
    ) {
      return {
        titulo: 'Te ayudo a decidir 🧭',
        mensaje: `¿Qué categoría te llama más${enCiudad}? 🍔 Comida | 🏥 Salud | 🔧 Servicios | 🐶 Mascotas | ✨ Belleza | 🌴 Turismo`,
      };
    }

    if (
      t.includes('quiero salir') || t.includes('algo para hacer') ||
      t.includes('a donde puedo ir') || t.includes('planes para hoy')
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
      t.includes('me escuchas') || t.includes('me lees') ||
      t.includes('estas ahi') || t.includes('sigues ahi') ||
      t.includes('estas activa') || t.includes('estas disponible')
    ) {
      return {
        titulo: this.elegir(['Sí, aquí estoy 👀', 'Sigo aquí 💙', 'Claro, te leo 😊']),
        mensaje: tieneHistorial
          ? this.elegir([
              'Sigo aquí. ¿Quieres continuar con lo que buscabas o necesitas algo diferente?',
              'Presente. ¿Seguimos con la búsqueda anterior o algo nuevo?',
            ])
          : this.elegir([
              'Estoy lista para ayudarte. Dime qué necesitas.',
              'Aquí estoy, listo para tu siguiente búsqueda.',
            ]),
      };
    }

    if (t.includes('me entiendes') || t.includes('entiendes lo que digo')) {
      return {
        titulo: 'Sí, haré mi mejor esfuerzo 💬',
        mensaje: this.elegir([
          'Entiendo muchas búsquedas aunque tengan faltas o estén escritas de forma informal.',
          'Intento entenderte aunque escribas rápido o con algunas faltas. Si algo no queda claro, dímelo.',
        ]),
      };
    }

    if (t.includes('puedes equivocarte') || t.includes('te equivocas') || t.includes('a veces fallas')) {
      return {
        titulo: 'Puedo mejorar contigo 🛠️',
        mensaje: tieneCiudad
          ? this.elegir([
              `A veces necesito más contexto. Si me das más detalle, puedo ser más precisa en ${ciudad}.`,
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
      t.includes('hola') || t.includes('buenas') || t.includes('hey') ||
      t.includes('holi') || t.includes('buen dia') || t.includes('buenos dias') ||
      t.includes('buenas tardes') || t.includes('buenas noches') || t === 'hi'
    ) {
      const saludo = this.saludoPorHora();
      const emoji  = this.emojiSaludo();
      return {
        titulo: `${saludo} ${emoji}`,
        mensaje: tieneHistorial
          ? this.elegir([
              `¿En qué más te puedo ayudar${enCiudad}?`,
              `¿Seguimos buscando o necesitas algo diferente${enCiudad}?`,
              `Aquí sigo. ¿Qué más necesitas${enCiudad}?`,
            ])
          : this.elegir(
              tieneCiudad
                ? [
                    `¿Qué te gustaría encontrar en ${ciudad}? Puedo ayudarte con comida, salud, servicios, promociones y más.`,
                    `Dime qué buscas y lo encuentro en ${ciudad}.`,
                  ]
                : [
                    '¿Qué te gustaría encontrar hoy? Puedo ayudarte con comida, salud, servicios, promociones y lugares cercanos.',
                    'Cuéntame qué necesitas y te ayudo a encontrarlo cerca de ti.',
                  ],
            ),
      };
    }

    // --------------------------------------------------
    // GRACIAS / DESPEDIDA
    // --------------------------------------------------
    if (t.includes('gracias') || t.includes('te agradezco') || t.includes('muchas gracias')) {
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
      t.includes('adios') || t.includes('nos vemos') || t.includes('hasta luego') ||
      t.includes('bye') || t.includes('chao') || t.includes('hasta pronto')
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
      t.includes('que me recomiendas') || t.includes('recomiendame algo') ||
      t.includes('sugiereme algo') || t.includes('dame una recomendacion') ||
      t.includes('quiero una recomendacion')
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
      t.includes('hablas espanol') || t.includes('entiendes espanol') ||
      t.includes('solo espanol') || t.includes('solo hablas espanol')
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
      t.includes('no entiendo') || t.includes('repiteme') ||
      t.includes('explicame') || t.includes('como funciona esto')
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
