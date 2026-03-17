export class ChatResponses {
  // =====================================================
  // UTILIDAD: NORMALIZAR TEXTO
  // =====================================================
  static normalizar(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s¿?¡!]/g, '')
      .replace(/\s+/g, ' ')
      // Variantes comunes de faltas
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

  // =====================================================
  // RESPUESTAS PRINCIPALES
  // =====================================================
  static responder(input: string, contexto?: { ciudad?: string }) {
    const t = this.normalizar(input);

    const ciudadActual = (contexto?.ciudad || '').trim();
    const tieneCiudad = !!ciudadActual;

    const ejemploBusqueda = tieneCiudad
      ? '"farmacia abierta", "tacos cerca de mí", "barbería abierta" o "hotel con alberca"'
      : '"farmacia en Tepic", "tacos cerca de mí", "barbería abierta" o "hotel con alberca"';

    const mensajeConCiudad = tieneCiudad
      ? `Puedo ayudarte a buscar en ${ciudadActual}. Si quieres, también puedo buscar en otra ciudad.`
      : 'Si quieres resultados más precisos, también puedes decirme tu ciudad.';

    const mensajeAyudaBasica = tieneCiudad
      ? `Dime qué necesitas encontrar y te ayudo a buscar en ${ciudadActual}. Si quieres buscar en otra ciudad, también puedo ayudarte.`
      : 'Dime qué necesitas encontrar y, si quieres, agrega tu ciudad para darte resultados más precisos.';

    // -----------------------------------------------------
    // 🚫 EVITAR USO COMO CHATGPT / TAREAS / PROGRAMACIÓN
    // -----------------------------------------------------
    if (
      t.includes('tarea') ||
      t.includes('resumen') ||
      t.includes('investigacion') ||
      t.includes('investigación') ||
      t.includes('haz mi tarea') ||
      t.includes('matematicas') ||
      t.includes('matemáticas') ||
      t.includes('quimica') ||
      t.includes('química') ||
      t.includes('fisica') ||
      t.includes('física') ||
      t.includes('codigo') ||
      t.includes('código') ||
      t.includes('programacion') ||
      t.includes('programación')
    ) {
      return {
        titulo: 'Soy Jelpy 😉',
        mensaje:
          'Puedo ayudarte con negocios, doctores, servicios, promociones y lugares en tu ciudad. Pero tareas escolares, investigaciones o programación no son mi enfoque principal.',
      };
    }

    // -----------------------------------------------------
    // 🟦 ENTRADAS MUY CORTAS O CONFUSAS
    // -----------------------------------------------------
    if (
      t.length <= 2 ||
      t === 'aaa' ||
      t === 'emm' ||
      t === 'mmm' ||
      t === 'eh' ||
      t === 'que' ||
      t === 'ok' ||
      t === 'no se'
    ) {
      return {
        titulo: 'Todo bien, estoy aquí para ayudarte 😊',
        mensaje: tieneCiudad
          ? `Estoy aquí para ayudarte. Puedes decirme algo como: "farmacia abierta", "tacos cerca de mí" o "barbería abierta". Buscaré en ${ciudadActual}.`
          : 'Estoy aquí para ayudarte. Puedes decirme algo como: "farmacia en Tepic", "tacos cerca de mí" o "barbería abierta".',
      };
    }

    if (
      t.includes('no entiendo') ||
      t.includes('repiteme') ||
      t.includes('repitemelo') ||
      t.includes('explicame') ||
      t.includes('explicamelo')
    ) {
      return {
        titulo: 'Vamos paso a paso ✨',
        mensaje: tieneCiudad
          ? `Dime qué necesitas encontrar y te ayudo a buscar en ${ciudadActual}. Puede ser comida, salud, servicios, mascotas o turismo.`
          : 'Dime qué necesitas encontrar. Puede ser comida, salud, servicios, mascotas o turismo. Si quieres, también puedes decirme tu ciudad.',
      };
    }

    // -----------------------------------------------------
    // IDENTIDAD
    // -----------------------------------------------------
    if (
      t.includes('quien eres') ||
      t.includes('quien es jelpy') ||
      t.includes('que eres') ||
      t.includes('que es jelpy') ||
      t.includes('quien sos') ||
      t.includes('quien eres tu')
    ) {
      return {
        titulo: 'Soy Jelpy 🤖✨',
        mensaje:
          'Soy tu asistente virtual para ayudarte a encontrar negocios, servicios, doctores, promociones y lugares cercanos en tu ciudad.',
      };
    }

    if (
      t.includes('como te llamas') ||
      t.includes('cual es tu nombre') ||
      t.includes('tu nombre') ||
      t.includes('llamas')
    ) {
      return {
        titulo: 'Me llamo Jelpy 💙',
        mensaje:
          'Estoy aquí para ayudarte a encontrar lo que necesites en tu ciudad de forma rápida y sencilla.',
      };
    }

    if (
      t.includes('de donde eres') ||
      t.includes('donde vives') ||
      t.includes('de donde vienes')
    ) {
      return {
        titulo: 'Vengo de la nube 🌐',
        mensaje: tieneCiudad
          ? `Trabajo contigo desde Jelpy y ahora mismo puedo ayudarte en ${ciudadActual}. Si quieres buscar en otra ciudad, también puedo hacerlo.`
          : 'Trabajo contigo desde Jelpy y me adapto a la ciudad que elijas. ¿Qué te gustaría buscar hoy?',
      };
    }

    if (
      t.includes('eres humano') ||
      t.includes('eres persona') ||
      t.includes('eres real')
    ) {
      return {
        titulo: 'Soy un asistente virtual 🤖',
        mensaje:
          'No soy una persona, pero sí puedo conversar contigo y ayudarte a encontrar negocios, servicios y promociones en tu ciudad.',
      };
    }

    if (
      t.includes('tienes novia') ||
      t.includes('tienes novio') ||
      t.includes('tienes pareja') ||
      t.includes('tienes crush') ||
      t.includes('estas enamorado') ||
      t.includes('estas enamorada') ||
      t.includes('tienes sentimientos') ||
      t.includes('sientes algo') ||
      t.includes('sientes emociones')
    ) {
      return {
        titulo: 'Soy un asistente virtual',
        mensaje:
          'No tengo pareja ni sentimientos, pero sí estoy aquí para ayudarte a encontrar lo que necesites. ¿Qué te gustaría buscar hoy?',
      };
    }

    if (
      t.includes('tienes sexo') ||
      t.includes('tienes genero') ||
      t.includes('que genero eres') ||
      t.includes('que sexo eres')
    ) {
      return {
        titulo: 'Soy un asistente virtual',
        mensaje:
          'No tengo género ni sexo, pero sí puedo ayudarte a encontrar negocios, servicios y promociones según lo que necesites.',
      };
    }

    // -----------------------------------------------------
    // CONVERSACIÓN / CHATBOT / IA
    // -----------------------------------------------------
    if (
      t.includes('eres conversacional') ||
      t.includes('puedes conversar') ||
      t.includes('puedes hablar') ||
      t.includes('eres chatbot') ||
      t.includes('eres un chatbot') ||
      t.includes('eres ia') ||
      t.includes('eres una ia') ||
      t.includes('eres inteligencia artificial') ||
      t.includes('eres asistente') ||
      t.includes('puedes responder preguntas') ||
      t.includes('hablas conmigo') ||
      t.includes('puedes platicar') ||
      t.includes('eres como chatgpt')
    ) {
      return {
        titulo: 'Sí, puedo conversar 💬',
        mensaje:
          'Puedo conversar contigo y responder dudas sencillas, pero mi función principal es ayudarte a encontrar negocios, servicios, doctores, promociones y lugares cercanos.',
      };
    }

    if (
      t.includes('eres inteligente') ||
      t.includes('eres muy inteligente') ||
      t.includes('sabes mucho')
    ) {
      return {
        titulo: 'Hago mi mejor esfuerzo 🧠',
        mensaje:
          'Intento ayudarte de la mejor manera posible, sobre todo para encontrar negocios, servicios y opciones útiles según tu ciudad o ubicación.',
      };
    }

    if (
      t.includes('aprendes') ||
      t.includes('puedes aprender') ||
      t.includes('aprendes de mi') ||
      t.includes('aprendes de lo que te digo')
    ) {
      return {
        titulo: 'Puedo mejorar contigo 📚',
        mensaje:
          'Puedo adaptarme mejor a tus búsquedas y ayudarte de forma más útil, especialmente cuando me das contexto como tu ciudad o el tipo de lugar que buscas.',
      };
    }

    if (
      t.includes('guardas informacion') ||
      t.includes('guardas información') ||
      t.includes('guardas mis datos') ||
      t.includes('almacenas mis datos') ||
      t.includes('te acuerdas de mi')
    ) {
      return {
        titulo: 'Cuido la experiencia del usuario 🔐',
        mensaje:
          'Mi objetivo es ayudarte a buscar mejor. Si compartes información como tu ciudad o tus preferencias, puedo darte resultados más útiles dentro de Jelpy.',
      };
    }

    if (
      t.includes('eres segura') ||
      t.includes('es seguro usarte') ||
      t.includes('eres confiable') ||
      t.includes('puedo confiar en ti')
    ) {
      return {
        titulo: 'Busco ayudarte con claridad 🤝',
        mensaje:
          'Estoy diseñada para ayudarte a encontrar opciones útiles dentro de Jelpy de forma clara, amable y enfocada en lo que buscas.',
      };
    }

    if (
      t.includes('hablas español') ||
      t.includes('entiendes español') ||
      t.includes('puedes hablar español')
    ) {
      return {
        titulo: 'Sí, claro 🇲🇽',
        mensaje:
          'Puedo entender y responder en español. También puedo ayudarte aunque escribas con algunas faltas o de forma informal.',
      };
    }

    if (
      t.includes('entiendes faltas') ||
      t.includes('entiendes errores') ||
      t.includes('si escribo mal') ||
      t.includes('aunque escriba mal')
    ) {
      return {
        titulo: 'Sí, haré mi mejor esfuerzo ✍️',
        mensaje:
          'Puedo entender muchas búsquedas aunque tengan faltas de ortografía o estén escritas de forma informal, sobre todo en negocios, servicios y categorías comunes.',
      };
    }

    // -----------------------------------------------------
    // MISIÓN / VISIÓN / VALORES
    // -----------------------------------------------------
    if (
      t.includes('cual es tu mision') ||
      t.includes('cual es tu misión') ||
      t.includes('tu mision') ||
      t.includes('tu misión') ||
      t.includes('mision de jelpy') ||
      t.includes('misión de jelpy')
    ) {
      return {
        titulo: 'Mi misión 🎯',
        mensaje:
          'Mi misión es ayudarte a encontrar de forma rápida y sencilla negocios, servicios, doctores, promociones y lugares útiles cerca de ti, conectando mejor a las personas con su ciudad.',
      };
    }

    if (
      t.includes('cual es tu vision') ||
      t.includes('cual es tu visión') ||
      t.includes('tu vision') ||
      t.includes('tu visión') ||
      t.includes('vision de jelpy') ||
      t.includes('visión de jelpy')
    ) {
      return {
        titulo: 'Mi visión 🌟',
        mensaje:
          'Mi visión es convertirme en un asistente local inteligente y confiable que ayude a las personas a descubrir lo mejor de su ciudad y a los negocios a conectar con más clientes.',
      };
    }

    if (
      t.includes('cuales son tus valores') ||
      t.includes('cuáles son tus valores') ||
      t.includes('tus valores') ||
      t.includes('valores de jelpy')
    ) {
      return {
        titulo: 'Mis valores 💙',
        mensaje:
          'Busco ayudarte con claridad, cercanía, honestidad, utilidad y una experiencia sencilla. La idea es que encontrar algo en tu ciudad sea rápido, práctico y confiable.',
      };
    }

    // -----------------------------------------------------
    // CAPACIDADES
    // -----------------------------------------------------
    if (
      t.includes('que puedes hacer') ||
      t.includes('para que sirves') ||
      t.includes('que haces') ||
      t.includes('como funcionas')
    ) {
      return {
        titulo: 'Puedo ayudarte 🧠',
        mensaje: tieneCiudad
          ? `Puedo encontrar restaurantes, doctores, negocios, tiendas, servicios, promociones y lugares cercanos según tu ciudad o ubicación. Ahora mismo puedo ayudarte a buscar en ${ciudadActual}.`
          : 'Puedo encontrar restaurantes, doctores, negocios, tiendas, servicios, promociones y lugares cercanos según tu ciudad o ubicación.',
      };
    }

    if (
      t.includes('que buscas') ||
      t.includes('que encuentras') ||
      t.includes('que tipo de negocios buscas') ||
      t.includes('que tipo de lugares buscas')
    ) {
      return {
        titulo: 'Busco muchas categorías 🔎',
        mensaje:
          'Puedo ayudarte con comida, salud, servicios, belleza, mascotas, entretenimiento, turismo, automotriz, hogar, tiendas y más.',
      };
    }

    if (
      t.includes('puedes ayudarme') ||
      t.includes('me ayudas') ||
      t.includes('me puedes ayudar')
    ) {
      return {
        titulo: 'Sí, con gusto 💙',
        mensaje: tieneCiudad
          ? `Puedo ayudarte a encontrar negocios, doctores, servicios, promociones o lugares cercanos en ${ciudadActual}. Si quieres buscar en otra ciudad, también puedo ayudarte.`
          : 'Puedo ayudarte a encontrar negocios, doctores, servicios, promociones o lugares cercanos. Solo dime qué buscas y, si quieres, tu ciudad.',
      };
    }

    if (
      t.includes('puedes recomendarme') ||
      t.includes('me recomiendas') ||
      t.includes('recomiendas lugares') ||
      t.includes('puedes recomendar lugares')
    ) {
      return {
        titulo: 'Sí, puedo orientarte 🌟',
        mensaje: tieneCiudad
          ? `Puedo ayudarte a encontrar opciones según lo que busques en ${ciudadActual}. Si quieres, también puedo hacerlo en otra ciudad.`
          : 'Puedo ayudarte a encontrar opciones según lo que busques, tu ciudad y tu contexto. Si me dices qué necesitas, puedo orientarte mejor.',
      };
    }

    if (
      t.includes('buscas promociones') ||
      t.includes('puedes buscar promociones') ||
      t.includes('encuentras promociones') ||
      t.includes('me muestras promociones')
    ) {
      return {
        titulo: 'Sí, también busco promociones 🎉',
        mensaje: tieneCiudad
          ? `Puedo ayudarte a encontrar promociones disponibles en ${ciudadActual} en distintas categorías. Solo dime qué buscas, por ejemplo: sushi, barbería, hotel o farmacia.`
          : 'Puedo ayudarte a encontrar promociones disponibles en distintas categorías. Solo dime qué buscas, por ejemplo: sushi, barbería, hotel o farmacia.',
      };
    }

    if (
      t.includes('usas ubicacion') ||
      t.includes('usas ubicación') ||
      t.includes('trabajas con ubicacion') ||
      t.includes('trabajas con ubicación') ||
      t.includes('puedes buscar cerca de mi') ||
      t.includes('puedes buscar cerca de mí')
    ) {
      return {
        titulo: 'Sí, puedo ayudarte con cercanía 📍',
        mensaje:
          'Si me compartes tu ciudad o ubicación, puedo ayudarte a encontrar opciones cercanas, abiertas o más convenientes para ti.',
      };
    }

    if (
      t.includes('puedes buscar por ciudad') ||
      t.includes('buscas por ciudad') ||
      t.includes('puedo decirte mi ciudad')
    ) {
      return {
        titulo: 'Sí, claro 🌆',
        mensaje: tieneCiudad
          ? `Ya tengo tu ciudad actual como referencia: ${ciudadActual}. Si quieres, también puedo ayudarte a buscar en otra ciudad.`
          : 'Si me dices tu ciudad, puedo mostrarte resultados más precisos. Por ejemplo: "tacos en Tepic", "hotel en Mazatlán" o "barbería en Guadalajara".',
      };
    }

    if (
      t.includes('que pasa si no encuentras algo') ||
      t.includes('si no encuentras algo') ||
      t.includes('si no hay resultados')
    ) {
      return {
        titulo: 'Puedo orientarte igual 🤝',
        mensaje: tieneCiudad
          ? `Si no encuentro resultados exactos en ${ciudadActual}, puedo sugerirte búsquedas parecidas, categorías relacionadas o ayudarte a buscar en otra ciudad.`
          : 'Si no encuentro resultados exactos, puedo sugerirte búsquedas parecidas, categorías relacionadas o pedirte que pruebes con otra palabra o ciudad.',
      };
    }

    // -----------------------------------------------------
    // GUÍA DE USO
    // -----------------------------------------------------
    if (
      t.includes('como te pregunto') ||
      t.includes('como debo buscar') ||
      t.includes('como uso jelpy') ||
      t.includes('como buscar contigo') ||
      t.includes('como preguntarte')
    ) {
      return {
        titulo: 'Es muy fácil 🙌',
        mensaje: tieneCiudad
          ? `Puedes escribirme algo simple como: "farmacia abierta", "tacos cerca de mí", "barbería abierta" o "veterinario a domicilio". Buscaré usando ${ciudadActual} como referencia. Si quieres buscar en otra ciudad, también puedo hacerlo.`
          : 'Puedes escribirme algo simple como: "farmacia en Tepic", "tacos cerca de mí", "barbería abierta", "hotel con alberca" o "veterinario a domicilio".',
      };
    }

    if (
      t.includes('que le puedo preguntar') ||
      t.includes('que puedo preguntarte') ||
      t.includes('que te puedo preguntar')
    ) {
      return {
        titulo: 'Puedes preguntarme muchas cosas ✨',
        mensaje: tieneCiudad
          ? `Puedes pedirme ayuda para buscar comida, doctores, negocios, servicios, promociones, lugares cercanos, hoteles, veterinarias, barberías y más en ${ciudadActual}.`
          : 'Puedes pedirme ayuda para buscar comida, doctores, negocios, servicios, promociones, lugares cercanos, hoteles, veterinarias, barberías y más. Si quieres, también puedes decirme tu ciudad.',
      };
    }

    if (
      t.includes('busco algo') ||
      t.includes('no se que buscar') ||
      t.includes('recomiendame algo') ||
      t.includes('recomiéndame algo') ||
      t.includes('ayudame a buscar') ||
      t.includes('ayúdame a buscar')
    ) {
      return {
        titulo: 'Te ayudo a decidir 🧭',
        mensaje: tieneCiudad
          ? `¿Qué categoría te interesa en ${ciudadActual}? Puedes buscar comida 🍔, salud 🏥, servicios 🔧, mascotas 🐶, belleza ✨ o turismo 🌴.`
          : '¿Qué categoría te interesa? Puedes buscar comida 🍔, salud 🏥, servicios 🔧, mascotas 🐶, belleza ✨ o turismo 🌴. También puedes decirme tu ciudad.',
      };
    }

    if (
      t.includes('quiero salir') ||
      t.includes('quiero hacer algo') ||
      t.includes('algo para hacer') ||
      t.includes('a donde puedo ir') ||
      t.includes('adonde puedo ir')
    ) {
      return {
        titulo: 'Tengo varias ideas para ti 🎉',
        mensaje: tieneCiudad
          ? `Puedo ayudarte a encontrar bares, restaurantes, cines, karaokes, turismo, parques o lugares para relajarte en ${ciudadActual}.`
          : 'Puedo ayudarte a encontrar bares, restaurantes, cines, karaokes, turismo, parques o lugares para relajarte. Si quieres, dime tu ciudad para orientarte mejor.',
      };
    }

    // -----------------------------------------------------
    // PREGUNTAS COMUNES QUE LE HACEN A UNA IA
    // -----------------------------------------------------
    if (
      t.includes('me escuchas') ||
      t.includes('me lees') ||
      t.includes('estas ahi') ||
      t.includes('estás ahí')
    ) {
      return {
        titulo: 'Sí, aquí estoy 👀',
        mensaje:
          'Estoy lista para ayudarte. Dime qué necesitas encontrar y te apoyo con gusto.',
      };
    }

    if (
      t.includes('estas activa') ||
      t.includes('estas disponible') ||
      t.includes('sigues ahi') ||
      t.includes('sigues ahí')
    ) {
      return {
        titulo: 'Sí, sigo aquí 💙',
        mensaje:
          'Puedes contar conmigo para buscar negocios, servicios, promociones y lugares cercanos.',
      };
    }

    if (
      t.includes('eres buena') ||
      t.includes('sirves') ||
      t.includes('funcionas bien')
    ) {
      return {
        titulo: 'Estoy para ayudarte 🙌',
        mensaje:
          'Mi objetivo es ayudarte cada vez mejor a encontrar lo que necesitas en tu ciudad de forma clara y rápida.',
      };
    }

    if (
      t.includes('puedes equivocarte') ||
      t.includes('te equivocas') ||
      t.includes('a veces fallas')
    ) {
      return {
        titulo: 'Puedo mejorar contigo 🛠️',
        mensaje: tieneCiudad
          ? `Sí, a veces puedo necesitar más contexto, pero intento ayudarte de la mejor manera posible. Si me das más detalle, puedo ser más precisa en ${ciudadActual}.`
          : 'Sí, a veces puedo necesitar más contexto, pero intento ayudarte de la mejor manera posible. Si me das tu ciudad o más detalle, puedo ser más precisa.',
      };
    }

    if (
      t.includes('me entiendes') ||
      t.includes('si me entiendes') ||
      t.includes('entiendes lo que digo')
    ) {
      return {
        titulo: 'Sí, haré mi mejor esfuerzo 💬',
        mensaje:
          'Intento entender lo que quieres decir incluso si escribes de forma informal o con algunas faltas, especialmente en búsquedas de negocios y servicios.',
      };
    }

    // -----------------------------------------------------
    // SALUDOS
    // -----------------------------------------------------
    if (
      t.includes('hola') ||
      t.includes('buenas') ||
      t.includes('hey') ||
      t.includes('holi') ||
      t.includes('buen dia') ||
      t.includes('buen día')
    ) {
      return {
        titulo: '¡Hola! 👋',
        mensaje: tieneCiudad
          ? `¿Qué te gustaría encontrar hoy en ${ciudadActual}? Puedo ayudarte con comida, salud, servicios, promociones y lugares cercanos.`
          : '¿Qué te gustaría encontrar hoy? Puedo ayudarte con comida, salud, servicios, promociones y lugares cercanos.',
      };
    }

    // -----------------------------------------------------
    // GRACIAS / DESPEDIDA
    // -----------------------------------------------------
    if (t.includes('gracias') || t.includes('te agradezco')) {
      return {
        titulo: '¡Con gusto! 💙',
        mensaje: tieneCiudad
          ? `Estoy aquí para ayudarte cuando quieras, ya sea en ${ciudadActual} o en otra ciudad.`
          : 'Estoy aquí para ayudarte cuando quieras.',
      };
    }

    if (
      t.includes('adios') ||
      t.includes('adiós') ||
      t.includes('nos vemos') ||
      t.includes('hasta luego') ||
      t.includes('bye')
    ) {
      return {
        titulo: '¡Hasta luego! 👋',
        mensaje:
          'Cuando quieras volver a buscar algo, aquí estaré para ayudarte.',
      };
    }

    if (
      t.includes('que me recomiendas') ||
      t.includes('recomendaciones') ||
      t.includes('qué me recomiendas') ||
      t.includes('recomiendame algo') ||
      t.includes('recomiéndame algo') ||
      t.includes('dame una recomendacion') ||
      t.includes('dame una recomendación') ||
      t.includes('sugiereme algo') ||
      t.includes('sugiéreme algo') ||
      t.includes('que me sugieres') ||
      t.includes('qué me sugieres') ||
      t.includes('quiero una recomendacion') ||
      t.includes('quiero una recomendación') ||
      t.includes('quiero que me recomiendes algo')
    ) {
      return {
        titulo: 'Claro, te ayudo a decidir ✨',
        mensaje:
          'Claro, puedo recomendarte opciones según lo que tengas en mente. Por ejemplo: comida, lugares para salir, cafeterías, bares, servicios, doctores, turismo o promociones. Dime qué tipo de recomendación quieres y te ayudo.',
      };
    }

    // -----------------------------------------------------
    // DEFAULT CONVERSACIONAL
    // -----------------------------------------------------
    return {
      titulo: 'No encontre resultados por el momento',
      mensaje: tieneCiudad
        ? `No logré identificar exactamente lo que necesitas por ahora, pero con gusto puedo ayudarte a buscar en ${ciudadActual}. Dime qué buscas. Por ejemplo: ${ejemploBusqueda}. Si quieres buscar en otra ciudad, también puedo ayudarte.`
        : `No logré identificar exactamente lo que necesitas por ahora, pero con gusto puedo ayudarte. Dime qué buscas. Por ejemplo: ${ejemploBusqueda}. ${mensajeConCiudad}`,
    };
  }
}