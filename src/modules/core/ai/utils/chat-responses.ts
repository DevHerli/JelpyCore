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

  // =====================================================
  // RESPUESTAS PRINCIPALES
  // =====================================================
  static responder(
    input: string,
    contexto?: { ciudad?: string; historialTurnos?: number },
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
    // 🟦 ENTRADAS MUY CORTAS O CONFUSAS
    // --------------------------------------------------
    if (t.length <= 2 || ['aaa','emm','mmm','eh','ok','no se','nop','np'].includes(t)) {
      return {
        titulo: 'Aquí estoy 😊',
        mensaje: tieneCiudad
          ? `Dime qué necesitas y busco en ${ciudad}. Por ejemplo: "farmacia abierta", "tacos cerca" o "barbería".`
          : 'Dime qué necesitas encontrar. Puedes buscar tacos, farmacias, doctores, barberías y mucho más.',
      };
    }

    if (
      t.includes('no entiendo') || t.includes('repiteme') ||
      t.includes('explicame') || t.includes('como funciona esto')
    ) {
      return {
        titulo: 'Claro, te explico ✨',
        mensaje: tieneCiudad
          ? `Solo escríbeme qué buscas y yo lo encuentro en ${ciudad}. Por ejemplo: "tacos", "farmacia abierta" o "doctor general".`
          : 'Solo escríbeme qué buscas: comida, salud, servicios, mascotas, turismo… y yo lo encuentro. Si me dices tu ciudad, los resultados son más precisos.',
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
          ? `Vivo en internet pero trabajo contigo. Ahora mismo puedo ayudarte a buscar en ${ciudad}.`
          : 'Existo en internet, pero me adapto a tu ciudad para ayudarte mejor. ¿Dónde quieres buscar?',
      };
    }

    if (
      t.includes('tienes novia') || t.includes('tienes novio') ||
      t.includes('estas enamorado') || t.includes('tienes sentimientos') ||
      t.includes('sientes algo') || t.includes('te gusta alguien')
    ) {
      return {
        titulo: 'Soy un asistente virtual 😅',
        mensaje: 'No tengo sentimientos, pero sí tengo ganas de ayudarte a encontrar lo que buscas. ¿Qué necesitas?',
      };
    }

    if (
      t.includes('tienes sexo') || t.includes('que genero eres') ||
      t.includes('eres hombre') || t.includes('eres mujer')
    ) {
      return {
        titulo: 'Soy un asistente sin género 🤖',
        mensaje: 'Soy solo software, pero estoy aquí para ayudarte con negocios, servicios y más.',
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
          ? `Aprendo de tus búsquedas y preferencias para darte mejores resultados en ${ciudad}.`
          : 'Aprendo de tus búsquedas para darte respuestas más útiles con el tiempo.',
      };
    }

    if (
      t.includes('guardas mis datos') || t.includes('almacenas mis datos') ||
      t.includes('te acuerdas de mi') || t.includes('guardas informacion')
    ) {
      return {
        titulo: 'Tu privacidad importa 🔐',
        mensaje: 'Guardo el contexto de tu conversación para darte mejores resultados, pero no compartimos tu información personal.',
      };
    }

    if (t.includes('eres segura') || t.includes('puedo confiar') || t.includes('eres confiable')) {
      return {
        titulo: 'Puedes confiar en mí 🤝',
        mensaje: 'Estoy diseñada para ayudarte de forma clara, amable y útil. ¿En qué te puedo ayudar?',
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
        mensaje: 'Conectar a las personas con los mejores negocios, servicios y lugares de su ciudad de forma rápida, sencilla y confiable.',
      };
    }

    if (t.includes('tu vision') || t.includes('vision de jelpy')) {
      return {
        titulo: 'Mi visión 🌟',
        mensaje: 'Ser el asistente local más útil de México: que encontrar algo en tu ciudad sea tan fácil como preguntarle a un amigo.',
      };
    }

    if (t.includes('tus valores') || t.includes('valores de jelpy')) {
      return {
        titulo: 'Mis valores 💙',
        mensaje: 'Claridad, cercanía, honestidad y utilidad. Quiero que cada búsqueda sea rápida y que encuentres exactamente lo que necesitas.',
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
          ? `Busco restaurantes, doctores, farmacias, barberías, tiendas, hoteles, servicios, promociones y más en ${ciudad}. Solo dime qué necesitas.`
          : 'Busco negocios, doctores, servicios, promociones y lugares según tu ciudad o ubicación. También puedo responder dudas sobre los resultados.',
      };
    }

    if (
      t.includes('puedes ayudarme') || t.includes('me ayudas') ||
      t.includes('me puedes ayudar') || t.includes('necesito ayuda')
    ) {
      return {
        titulo: this.elegir(['¡Claro! 💙', 'Con mucho gusto 😊', 'Sí, dime 🙌']),
        mensaje: tieneCiudad
          ? `Dime qué buscas y lo encuentro en ${ciudad}.`
          : 'Dime qué necesitas. Si me dices tu ciudad, los resultados serán más precisos.',
      };
    }

    if (
      t.includes('puedes recomendarme') || t.includes('me recomiendas') ||
      t.includes('que recomiendas') || t.includes('que me sugieres')
    ) {
      return {
        titulo: this.elegir(['Claro ✨', 'Con gusto 🌟', 'Puedo orientarte 😊']),
        mensaje: tieneCiudad
          ? `Puedo recomendarte según lo que busques en ${ciudad}. ¿Qué tipo de lugar te interesa?`
          : 'Dime qué categoría te interesa y te oriento: comida, salud, servicios, mascotas, turismo…',
      };
    }

    if (
      t.includes('buscas promociones') || t.includes('encuentras promociones') ||
      t.includes('hay promociones') || t.includes('tienen ofertas')
    ) {
      return {
        titulo: 'Sí, también encuentro promociones 🎉',
        mensaje: tieneCiudad
          ? `Puedo buscar promociones activas en ${ciudad}. Dime en qué categoría: sushi, barbería, hotel, farmacia…`
          : 'Dime qué tipo de negocio y tu ciudad, y busco las mejores promociones disponibles.',
      };
    }

    if (
      t.includes('usas ubicacion') || t.includes('puedes buscar cerca') ||
      t.includes('cerca de mi') || t.includes('negocios cercanos')
    ) {
      return {
        titulo: 'Sí, busco por cercanía 📍',
        mensaje: tieneCiudad
          ? `Con tu ubicación o usando ${ciudad} como referencia, puedo mostrarte opciones cercanas.`
          : 'Si me compartes tu ubicación o ciudad, puedo ayudarte a encontrar lugares cercanos.',
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
          ? `Escríbeme algo como: "farmacia abierta", "tacos cerca de mí" o "doctor general". Usaré ${ciudad} como referencia.`
          : 'Escríbeme algo como: "farmacia en Tepic", "tacos cerca de mí" o "barbería abierta". Así de fácil.',
      };
    }

    if (
      t.includes('que le puedo preguntar') || t.includes('que puedo preguntarte') ||
      t.includes('que tipos de cosas') || t.includes('que mas puedes')
    ) {
      return {
        titulo: 'Puedes preguntarme muchas cosas ✨',
        mensaje: tieneCiudad
          ? `Comida, doctores, negocios, servicios, promociones, hoteles, veterinarias, barberías y más en ${ciudad}.`
          : 'Comida, doctores, negocios, servicios, promociones, hoteles, veterinarias, barberías y más. ¡Inténtalo!',
      };
    }

    if (
      t.includes('no se que buscar') || t.includes('ayudame a decidir') ||
      t.includes('no sé que quiero') || t.includes('dame ideas')
    ) {
      return {
        titulo: 'Te ayudo a decidir 🧭',
        mensaje: tieneCiudad
          ? `¿Qué categoría te llama más en ${ciudad}? 🍔 Comida | 🏥 Salud | 🔧 Servicios | 🐶 Mascotas | ✨ Belleza | 🌴 Turismo`
          : '¿Qué categoría te llama más? 🍔 Comida | 🏥 Salud | 🔧 Servicios | 🐶 Mascotas | ✨ Belleza | 🌴 Turismo',
      };
    }

    if (
      t.includes('quiero salir') || t.includes('algo para hacer') ||
      t.includes('a donde puedo ir') || t.includes('planes para hoy')
    ) {
      return {
        titulo: 'Tengo ideas para ti 🎉',
        mensaje: tieneCiudad
          ? `Puedo ayudarte a encontrar bares, restaurantes, karaokes, parques o turismo en ${ciudad}. ¿Qué te late más?`
          : 'Puedo ayudarte a encontrar bares, restaurantes, karaokes, parques o turismo. ¿En qué ciudad estás?',
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
          ? 'Sigo aquí. ¿Quieres continuar con lo que buscabas o necesitas algo diferente?'
          : 'Estoy lista para ayudarte. Dime qué necesitas.',
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
          ? `A veces necesito más contexto. Si me das más detalle, puedo ser más precisa en ${ciudad}.`
          : 'A veces necesito más detalle para darte resultados exactos. No dudes en reformular si algo no está bien.',
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
          : tieneCiudad
            ? `¿Qué te gustaría encontrar en ${ciudad}? Puedo ayudarte con comida, salud, servicios, promociones y más.`
            : '¿Qué te gustaría encontrar hoy? Puedo ayudarte con comida, salud, servicios, promociones y lugares cercanos.',
      };
    }

    // --------------------------------------------------
    // GRACIAS / DESPEDIDA
    // --------------------------------------------------
    if (t.includes('gracias') || t.includes('te agradezco') || t.includes('muchas gracias')) {
      return {
        titulo: this.elegir(['¡Con gusto! 💙', '¡Para eso estoy! 😊', 'Un placer 🙌']),
        mensaje: tieneCiudad
          ? `Cuando quieras volver a buscar algo en ${ciudad} o en otra ciudad, aquí estaré.`
          : 'Estoy aquí siempre que me necesites.',
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
        mensaje: 'Entiendo español, incluyendo escritura informal y algunas faltas de ortografía. ¿En qué te puedo ayudar?',
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
