export class ChatResponses {

    // =====================================================
    // UTILIDAD: NORMALIZAR TEXTO (sin eliminar tanto)
    // =====================================================
    static normalizar(texto: string): string {
      return texto
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s¿?¡!]/g, '')
        .replace(/\s+/g, ' ')
        // Variantes comunes de faltas
        .replace(/kien|qien|kin/g, 'quien')
        .replace(/kual|qual/g, 'cual')
        .replace(/komo|como/g, 'como')
        .replace(/yamas|llamaz|llamas|yamaz/g, 'llamas')
        .replace(/ke\b/g, 'que')
        .trim();
    }
  
    // =====================================================
    // RESPUESTAS PRINCIPALES
    // =====================================================
    static responder(input: string) {
      const t = this.normalizar(input);
  
      // -----------------------------------------------------
      // 🚫 EVITAR USO COMO CHATGPT
      // -----------------------------------------------------
      if (
        t.includes('tarea') ||
        t.includes('resumen') ||
        t.includes('investigacion') ||
        t.includes('haz mi tarea') ||
        t.includes('matematicas') ||
        t.includes('quimica') ||
        t.includes('fisica') ||
        t.includes('codigo') ||
        t.includes('programacion')
      ) {
        return {
          titulo: 'Soy Jelpy 😉',
          mensaje:
            'Puedo ayudarte con negocios, doctores, servicios y promociones en tu ciudad. Pero tareas, investigaciones o programación no son mi área.',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 ASISTENTE PACIENTE
      // -----------------------------------------------------
      if (
        t.length <= 2 ||
        t === 'aaa' ||
        t === 'emm' ||
        t === 'que' ||
        t === 'nose' ||
        t === 'no se'
      ) {
        return {
          titulo: 'Todo bien 💙',
          mensaje: 'Estoy aquí para ayudarte. ¿Qué estás buscando? ¿Comida, salud o servicios?',
        };
      }
  
      if (t.includes('no entiendo') || t.includes('repiteme')) {
        return {
          titulo: 'Vamos paso a paso ✨',
          mensaje: 'Dime qué necesitas: ¿comida, salud o servicios en tu ciudad?',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 QUIÉN ERES / IDENTIDAD
      // (TODAS LAS VARIANTES ORTOGRÁFICAS)
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
            'Tu asistente virtual. Te ayudo a encontrar locales, servicios, doctores y promociones cerca de ti.',
        };
      }
  
      if (
        t.includes('como te llamas') ||
        t.includes('cual es tu nombre') ||
        t.includes('tu nombre') ||
        t.includes('llamas')      // soporta “komo te yamas”
      ) {
        return {
          titulo: 'Me llamo Jelpy 💙',
          mensaje: 'Estoy aquí para ayudarte a encontrar lo que necesites en tu ciudad.',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 ¿DE DÓNDE ERES?
      // -----------------------------------------------------
      if (t.includes('de donde eres')) {
        return {
          titulo: 'Vengo de la nube 🌐',
          mensaje:
            'Trabajo contigo desde la ciudad que elijas en Jelpy. ¿Qué te gustaría buscar hoy?',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 ¿QUÉ PUEDES HACER?
      // -----------------------------------------------------
      if (
        t.includes('que puedes hacer') ||
        t.includes('para que sirves') ||
        t.includes('que haces') ||
        t.includes('como funcionas')
      ) {
        return {
          titulo: 'Puedo ayudarte 🧠',
          mensaje:
            'Encuentro restaurantes, doctores, negocios, tiendas, servicios y promociones según tu ciudad. Soy como un mapa inteligente.',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 NAVEGACIÓN GUIADA
      // -----------------------------------------------------
      if (
        t.includes('busco algo') ||
        t.includes('no se que buscar') ||
        t.includes('recomiendame algo') ||
        t.includes('ayudame a buscar')
      ) {
        return {
          titulo: 'Te ayudo a decidir 🧭',
          mensaje:
            '¿Qué categoría te interesa?  👉 Comida 🍔  👉 Salud 🏥  👉 Servicios 🔧 También dime tu ciudad.',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 SALUDOS
      // -----------------------------------------------------
      if (
        t.includes('hola') ||
        t.includes('buenas') ||
        t.includes('hey') ||
        t.includes('holi')
      ) {
        return {
          titulo: '¡Hola! 👋',
          mensaje:
            '¿Qué te gustaría encontrar hoy? Puedo ayudarte con comida, salud, servicios y promociones.',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 GRACIAS
      // -----------------------------------------------------
      if (t.includes('gracias') || t.includes('te agradezco')) {
        return {
          titulo: '¡Con gusto! 💙',
          mensaje: 'Estoy aquí para ayudarte cuando quieras.',
        };
      }
  
      // -----------------------------------------------------
      // 🟦 DEFAULT
      // -----------------------------------------------------
      return {
        titulo: 'Aquí estoy ✨',
        mensaje:
          '¿Qué necesitas encontrar hoy? Puedo ayudarte con restaurantes, doctores, servicios y promociones. Dime tu ciudad y lo buscamos.',
      };
    }
  }
  