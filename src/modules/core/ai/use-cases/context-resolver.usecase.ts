import { Injectable } from '@nestjs/common';
import { ConversationSession } from '../../conversation/entities/conversation-session.entity';
import { REFINEMENT_PHRASES } from '../utils/refinement-phrases';
import { ConversationClassifier } from '../utils/conversation-classifier';
import { ChatResponses } from '../utils/chat-responses';

/**
 * Palabras y frases que indican que el usuario se refiere a algo anterior.
 * Si el mensaje SOLO contiene este tipo de palabras (sin entidad nueva),
 * es un mensaje de seguimiento.
 */
const PALABRAS_SEGUIMIENTO = [
  // Referencias directas
  'ese', 'esa', 'esos', 'esas', 'ese lugar', 'esa tienda', 'ese negocio',
  'el primero', 'la primera', 'el segundo', 'la segunda', 'el tercero',
  'el de arriba', 'el de abajo', 'el ultimo', 'el último',
  // Consultas sobre el resultado anterior
  'tiene domicilio', 'hacen domicilio', 'mandan a domicilio', 'llevan a domicilio',
  'está abierto', 'esta abierto', 'abre ahora', 'está abierta', 'esta abierta',
  'qué horario', 'que horario', 'a qué hora', 'a que hora', 'cuándo abren',
  'cuando abren', 'cuándo cierran', 'cuando cierran',
  'su teléfono', 'su telefono', 'su número', 'su numero', 'cómo lo llamo',
  'como lo llamo', 'teléfono del', 'telefono del',
  'dónde está', 'donde esta', 'cómo llego', 'como llego', 'su dirección',
  'su direccion', 'la dirección', 'la direccion',
  'cuánto cuesta', 'cuanto cuesta', 'qué precio', 'que precio', 'su precio',
  'más información', 'mas informacion', 'mas info', 'más info',
  'cuál es mejor', 'cual es mejor', 'cuál recomiendas', 'cual recomiendas',
  // Continuación de búsqueda
  'también busca', 'tambien busca', 'también en', 'tambien en',
  'busca también', 'busca tambien', 'y en', 'o en',
  'y los de', 'y las de', 'y el de',
  'el mismo pero', 'la misma pero', 'igual pero',
  // Preguntas cortas de seguimiento
  'tiene', 'tienen', 'hay', 'ofrecen', 'manejan', 'hacen',
  // Precio
  'cuanto cuesta', 'cuánto cuesta', 'que precio', 'qué precio', 'cuanto cobran',
  'cuánto cobran', 'cuanto vale', 'cuánto vale', 'su precio', 'los precios',
  'es caro', 'es barato', 'precio', 'costo', 'cobran',
  // Pago
  'aceptan tarjeta', 'aceptan tarjetas', 'pagan con tarjeta', 'con tarjeta',
  'efectivo', 'solo efectivo', 'formas de pago', 'metodos de pago', 'métodos de pago',
  'transferencia', 'oxxo', 'mercado pago',
  // Redes sociales
  'su instagram', 'tienen instagram', 'su insta', 'su face', 'su facebook',
  'su whatsapp', 'su pagina', 'su página', 'redes sociales', 'sus redes',
  'en instagram', 'instagram de', 'facebook de',
  // Estacionamiento / instalaciones
  'estacionamiento', 'tienen estacionamiento', 'hay donde estacionar',
  'hay parking', 'parking', 'accesible', 'para discapacitados',
  'aire acondicionado', 'terraza', 'area de niños', 'área de niños',
  // Menú / productos
  'su menu', 'su menú', 'que venden', 'qué venden', 'que ofrecen', 'qué ofrecen',
  'que tienen', 'qué tienen', 'su carta', 'la carta', 'sus platillos',
  // Reservaciones
  'aceptan reservaciones', 'se puede reservar', 'reservacion', 'reservación',
  'hay que reservar',
];

/**
 * Palabras de referencia a items numerados dentro de los resultados.
 */
const REFERENCIAS_NUMERADAS: Record<string, number> = {
  'primero': 0, 'primera': 0,
  'segundo': 1, 'segunda': 1,
  'tercero': 2, 'tercera': 2,
  'cuarto': 3, 'cuarta': 3,
  'quinto': 4, 'quinta': 4,
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
};

export interface ContextResolution {
  /** ¿Es un mensaje de seguimiento del contexto anterior? */
  esSeguimiento: boolean;

  /** Texto enriquecido listo para procesar (puede incluir contexto de sesión) */
  textoEnriquecido: string;

  /** Item específico al que el usuario se refiere (si aplica) */
  referenciaItem?: any;

  /** Contexto de la sesión disponible */
  contextoDisponible: boolean;

  /** Tipo de seguimiento detectado */
  tipoSeguimiento?:
    | 'referencia_item'
    | 'consulta_detalles'
    | 'busqueda_variante'
    | 'refinamiento'
    | 'confirmacion_pendiente'
    | 'ninguno';

  /**
   * JLP-CONFIRMACION-PENDIENTE-FIX: cuando el usuario responde "No" (o
   * similar) a una pregunta de confirmación pendiente (ver
   * `PreguntaPendiente` más abajo), no hay ninguna búsqueda que lanzar —
   * hay que responder directo con esto, sin pasar por clasificación/
   * búsqueda.
   */
  respuestaDirecta?: { titulo: string; mensaje: string };
}

/**
 * JLP-CONFIRMACION-PENDIENTE-FIX: descripción mínima de una pregunta de
 * confirmación ("¿Quieres que busque otros negocios similares que sí
 * tengan promo?") que Jelpy le hizo al usuario y que aún no fue
 * respondida. Se guarda en `sesion.ultimosFiltros.pendienteConfirmacion`
 * (ver `ConversationService.guardarPreguntaPendiente`) para que, si el
 * usuario responde con un simple "Sí"/"No", sepamos qué acción ejecutar en
 * vez de caer en "no entendí".
 */
export interface PreguntaPendiente {
  tipo: 'buscar_similares_promo';
  categoria?: string;
  ciudad?: string;
}

@Injectable()
export class ContextResolverUseCase {

  private normalizar(texto: string): string {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Analiza el mensaje actual junto con el contexto de la sesión anterior
   * para determinar si es un seguimiento y enriquecer la query.
   */
  execute(
    mensajeActual: string,
    sesion: ConversationSession | null,
  ): ContextResolution {
    const textoNorm = this.normalizar(mensajeActual);
    const sinContexto: ContextResolution = {
      esSeguimiento: false,
      textoEnriquecido: mensajeActual,
      contextoDisponible: false,
      tipoSeguimiento: 'ninguno',
    };

    // Sin sesión o sin contexto previo → procesar normal
    if (!sesion || !sesion.ultimoIntent) return sinContexto;

    // ------------------------------------------------------------------
    // 0. CONFIRMACIÓN DE UNA PREGUNTA PENDIENTE
    //    ("¿Quieres que busque otros negocios similares que sí tengan
    //    promo?" -> "Sí" / "No")
    //
    // JLP-CONFIRMACION-PENDIENTE-FIX: bug reportado por el usuario — Jelpy
    // preguntaba esto y, al responder "Sí", el usuario recibía "Dime qué
    // necesitas y busco en Tepic...", ignorando la propia pregunta de
    // Jelpy. Se revisa ANTES que cualquier otra rama porque una respuesta
    // de confirmación de 2 caracteres ("Sí"/"No") no calza con ningún otro
    // patrón de seguimiento (no es referencia numerada, no trae palabra de
    // negocio, no trae "también"/"pero en") y de otro modo caería directo
    // en `sinContexto`.
    // ------------------------------------------------------------------
    const pendiente = (sesion.ultimosFiltros as any)?.pendienteConfirmacion as
      | PreguntaPendiente
      | undefined;

    if (pendiente) {
      const confirmacion = ChatResponses.detectarConfirmacion(mensajeActual);

      if (confirmacion === 'afirmativa') {
        const categoria = pendiente.categoria || sesion.ultimaQuery || '';
        const ciudadPendiente = pendiente.ciudad || sesion.ciudad || '';
        const textoEnriquecido = [categoria, 'con promociones', ciudadPendiente ? `en ${ciudadPendiente}` : '']
          .filter(Boolean)
          .join(' ')
          .trim();

        if (textoEnriquecido) {
          return {
            esSeguimiento: true,
            textoEnriquecido,
            contextoDisponible: true,
            tipoSeguimiento: 'confirmacion_pendiente',
          };
        }
      }

      if (confirmacion === 'negativa') {
        return {
          esSeguimiento: true,
          textoEnriquecido: mensajeActual,
          contextoDisponible: true,
          tipoSeguimiento: 'confirmacion_pendiente',
          respuestaDirecta: {
            titulo: '¡Entendido! 👍',
            mensaje: '¿En qué más te ayudo? Puedo buscar otro negocio, servicio o categoría cuando quieras.',
          },
        };
      }
    }

    const tieneResultadosPrevios =
      Array.isArray(sesion.ultimoResultado) && sesion.ultimoResultado.length > 0;

    // ------------------------------------------------------------------
    // 1. REFERENCIA A UN ITEM NUMERADO ("el primero", "el segundo")
    // ------------------------------------------------------------------
    if (tieneResultadosPrevios) {
      for (const [clave, indice] of Object.entries(REFERENCIAS_NUMERADAS)) {
        if (textoNorm.includes(clave)) {
          const item = sesion.ultimoResultado![indice];
          if (item) {
            return {
              esSeguimiento: true,
              textoEnriquecido: mensajeActual,
              referenciaItem: item,
              contextoDisponible: true,
              tipoSeguimiento: 'referencia_item',
            };
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 2. CONSULTA DE DETALLES SOBRE EL RESULTADO ANTERIOR
    //    ("¿tiene domicilio?", "¿a qué hora abren?", "¿cuánto cuesta?")
    // ------------------------------------------------------------------
    const esPreguntaDeDetalle = PALABRAS_SEGUIMIENTO.some((palabra) =>
      textoNorm.includes(this.normalizar(palabra)),
    );

    // JLP-CONTEXT-THREAD-FIX: el límite original de 4 palabras estaba
    // pensado para mensajes ORGANICOS y cortos escritos por el usuario
    // ("cuánto cuesta", "cuál es su teléfono"). Pero muchos de los chips
    // que el propio Jelpy ofrece como sugerencia (`suggestions.util.ts`)
    // son preguntas completas más largas — ej. "¿Quieres ver los precios
    // disponibles?" (5 palabras) — que SÍ están en `PALABRAS_SEGUIMIENTO`
    // pero quedaban excluidas solo por el conteo de palabras, perdiendo la
    // respuesta de detalle ya armada (`generarRespuestaDetalle`) y cayendo
    // en una búsqueda real menos precisa. Se amplía el límite para cubrir
    // la longitud típica de esas preguntas generadas por Jelpy.
    const esTextoMuyCorto = textoNorm.split(' ').length <= 8;

    if (esPreguntaDeDetalle && esTextoMuyCorto && tieneResultadosPrevios) {
      return {
        esSeguimiento: true,
        textoEnriquecido: mensajeActual,
        referenciaItem: sesion.ultimoResultado![0], // asume el primer resultado
        contextoDisponible: true,
        tipoSeguimiento: 'consulta_detalles',
      };
    }

    // ------------------------------------------------------------------
    // 3. VARIANTE DE BÚSQUEDA CON NUEVA CIUDAD O FILTRO
    //    ("también busca en Guadalajara", "pero con domicilio", "igual pero con promo")
    // ------------------------------------------------------------------
    const esVariante =
      (textoNorm.includes('tambien') || textoNorm.includes('también') ||
       textoNorm.includes('igual pero') || textoNorm.includes('pero en') ||
       textoNorm.includes('ahora en') || textoNorm.includes('y en')) &&
      sesion.ultimaQuery;

    if (esVariante) {
      // Enriquecer el texto con la query anterior + el modificador nuevo
      const textoEnriquecido = `${sesion.ultimaQuery} ${mensajeActual}`;
      return {
        esSeguimiento: true,
        textoEnriquecido,
        contextoDisponible: true,
        tipoSeguimiento: 'busqueda_variante',
      };
    }

    // ------------------------------------------------------------------
    // 4. REFINAMIENTO DE LA BÚSQUEDA ANTERIOR
    //    ("más cerca", "más barato", "otra opción", "solo abiertos"...)
    //
    // JLP-CONTEXT-THREAD-FIX: bug reportado por el usuario — tras buscar
    // "farmacias abiertas", Jelpy ofrecía el chip "¿Quieres ver la más
    // cercana a ti?". Al tocarlo, `ConversationClassifier` SÍ lo
    // clasificaba correctamente como `search_refinement` (usa esta misma
    // lista, ver `refinement-phrases.ts`), pero este resolver no sabía
    // que era un refinamiento y devolvía el texto tal cual ("más cercana
    // a ti", sin categoría) — o, si además se había perdido la sesión, el
    // mensaje ni siquiera llegaba a clasificarse como búsqueda y el
    // usuario recibía "No entendí bien", rompiendo el hilo de la
    // conversación. Igual que en el punto 3, anteponemos la query
    // anterior para que el motor de búsqueda real conserve la categoría
    // ("farmacia más cercana a ti" en vez de solo "más cercana a ti").
    // ------------------------------------------------------------------
    const esRefinamiento =
      REFINEMENT_PHRASES.some((p) => textoNorm.includes(this.normalizar(p))) &&
      sesion.ultimaQuery;

    if (esRefinamiento) {
      const textoEnriquecido = `${sesion.ultimaQuery} ${mensajeActual}`;
      return {
        esSeguimiento: true,
        textoEnriquecido,
        contextoDisponible: true,
        tipoSeguimiento: 'refinamiento',
      };
    }

    // ------------------------------------------------------------------
    // 5. RESPALDO GENÉRICO: cualquier otro seguimiento con búsqueda activa
    //
    // JLP-CONTEXT-THREAD-FIX: bug reportado por el usuario — Jelpy ofrece
    // decenas de chips distintos por categoría (ver `suggestions.util.ts`:
    // "¿Quieres ver cuáles tienen medicamentos genéricos?", "¿Buscas
    // alguna especialidad médica?", "¿Quieres ver los precios
    // disponibles?"...) que es imposible enumerar por completo a mano en
    // `PALABRAS_SEGUIMIENTO`/`REFINEMENT_PHRASES` sin que la lista se
    // desincronice de nuevo (ya pasó dos veces). Antes, cualquier chip que
    // no calzara EXACTO en esas listas se enviaba tal cual al motor de
    // búsqueda (perdiendo la categoría, ej. "farmacia") o, peor, ni
    // siquiera se clasificaba como búsqueda y el usuario recibía
    // "No entendí bien" justo después de un resultado exitoso.
    //
    // Regla: si hay una búsqueda anterior (`sesion.ultimaQuery`), el
    // mensaje actual NO introduce su propio término de negocio nuevo (es
    // decir, no parece una búsqueda independiente tipo "quiero tacos") Y
    // TAMPOCO es un mensaje conversacional ya reconocido por
    // `ChatResponses` (saludo, despedida, gracias, queja, fuera de
    // alcance, etc. — esos deben seguir su propio camino de chat, no
    // contaminarse con "farmacia" antepuesto), lo tratamos como
    // continuación de la búsqueda anterior y anteponemos la query previa.
    // Esto es exactamente simétrico a la ampliación que se hizo en
    // `ConversationClassifier.classify()` para el mismo caso.
    // ------------------------------------------------------------------
    if (
      sesion.ultimaQuery &&
      ChatResponses.detectarIntent(mensajeActual) === 'fallback' &&
      !ConversationClassifier.contieneTerminoDeNegocio(mensajeActual)
    ) {
      const textoEnriquecido = `${sesion.ultimaQuery} ${mensajeActual}`;
      return {
        esSeguimiento: true,
        textoEnriquecido,
        contextoDisponible: true,
        tipoSeguimiento: 'refinamiento',
      };
    }

    return sinContexto;
  }

  /**
   * Genera una respuesta de detalle cuando el usuario pregunta sobre
   * el primer resultado anterior sin hacer una búsqueda nueva.
   */
  generarRespuestaDetalle(
    mensajeNorm: string,
    item: any,
  ): { titulo: string; mensaje: string; pendienteConfirmacion?: PreguntaPendiente } | null {
    const nombreLugar = item?.nombre || item?.nombre_negocio || 'ese lugar';

    if (
      mensajeNorm.includes('domicilio') ||
      mensajeNorm.includes('a domicilio') ||
      mensajeNorm.includes('envio') ||
      mensajeNorm.includes('envío') ||
      mensajeNorm.includes('mandan')
    ) {
      if (item?.tieneDomicilio) {
        return {
          titulo: `${nombreLugar} sí tiene servicio a domicilio 🛵`,
          mensaje: 'Para pedirlo puedes llamar directamente al negocio o visitar su perfil en Jelpy.',
        };
      }
      return {
        titulo: `${nombreLugar} no tiene domicilio registrado`,
        mensaje: 'Te recomiendo llamar directamente para confirmar si ofrecen este servicio.',
      };
    }

    if (
      mensajeNorm.includes('telefono') ||
      mensajeNorm.includes('teléfono') ||
      mensajeNorm.includes('numero') ||
      mensajeNorm.includes('número') ||
      mensajeNorm.includes('llamar')
    ) {
      if (item?.telefono) {
        return {
          titulo: `Teléfono de ${nombreLugar}`,
          mensaje: `📞 ${item.telefono}`,
        };
      }
      return {
        titulo: `${nombreLugar} no tiene teléfono registrado`,
        mensaje: 'Puedes visitar su perfil en Jelpy para más información de contacto.',
      };
    }

    if (
      mensajeNorm.includes('horario') ||
      mensajeNorm.includes('hora') ||
      mensajeNorm.includes('abren') ||
      mensajeNorm.includes('cierran') ||
      mensajeNorm.includes('abierto')
    ) {
      if (item?.horario) {
        return {
          titulo: `Horario de ${nombreLugar}`,
          mensaje: `🕐 ${item.horario}`,
        };
      }
      return {
        titulo: `No tengo el horario de ${nombreLugar}`,
        mensaje: 'Te recomiendo llamar directamente para confirmar sus horarios de atención.',
      };
    }

    if (
      mensajeNorm.includes('direccion') ||
      mensajeNorm.includes('dirección') ||
      mensajeNorm.includes('donde esta') ||
      mensajeNorm.includes('dónde está') ||
      mensajeNorm.includes('como llego') ||
      mensajeNorm.includes('cómo llego')
    ) {
      if (item?.ciudad) {
        return {
          titulo: `Ubicación de ${nombreLugar}`,
          mensaje: `📍 Se encuentra en ${item.ciudad}. Puedes ver la dirección exacta en su perfil dentro de Jelpy.`,
        };
      }
      return {
        titulo: `Ubicación de ${nombreLugar}`,
        mensaje: 'Puedes ver la dirección exacta visitando su perfil dentro de Jelpy.',
      };
    }

    if (
      mensajeNorm.includes('promo') ||
      mensajeNorm.includes('promocion') ||
      mensajeNorm.includes('promoción') ||
      mensajeNorm.includes('descuento') ||
      mensajeNorm.includes('oferta')
    ) {
      if (item?.promo) {
        return {
          titulo: `${nombreLugar} tiene promoción activa 🎉`,
          mensaje: 'Visita su perfil en Jelpy para ver los detalles de la promoción.',
        };
      }
      return {
        titulo: `${nombreLugar} no tiene promociones registradas en este momento`,
        mensaje: '¿Quieres que busque otros negocios similares que sí tengan promo? 💸',
        // JLP-CONFIRMACION-PENDIENTE-FIX: se guarda en la sesión (ver
        // `ai.service.ts`) para que, si el usuario responde "Sí"/"No" a
        // esta pregunta, sepamos qué hacer en vez de caer en "no entendí".
        pendienteConfirmacion: {
          tipo: 'buscar_similares_promo',
          categoria: item?.categoria || item?.nombreCategoria,
          ciudad: item?.ciudad || item?.nombreCiudad,
        },
      };
    }

    if (
      mensajeNorm.includes('cuanto cuesta') ||
      mensajeNorm.includes('cuánto cuesta') ||
      mensajeNorm.includes('que precio') ||
      mensajeNorm.includes('qué precio') ||
      mensajeNorm.includes('precio') ||
      mensajeNorm.includes('cobran') ||
      mensajeNorm.includes('costo')
    ) {
      return {
        titulo: `Precios de ${nombreLugar}`,
        mensaje: 'Para conocer los precios actualizados te recomiendo visitar su perfil en Jelpy o llamar directamente al negocio. Los precios pueden variar.',
      };
    }

    if (
      mensajeNorm.includes('tarjeta') ||
      mensajeNorm.includes('efectivo') ||
      mensajeNorm.includes('formas de pago') ||
      mensajeNorm.includes('metodos de pago') ||
      mensajeNorm.includes('transferencia') ||
      mensajeNorm.includes('mercado pago')
    ) {
      return {
        titulo: `Métodos de pago en ${nombreLugar}`,
        mensaje: 'Para confirmar si aceptan tarjeta, efectivo o transferencia te recomiendo llamar directamente o revisar su perfil en Jelpy.',
      };
    }

    if (
      mensajeNorm.includes('instagram') ||
      mensajeNorm.includes('insta') ||
      mensajeNorm.includes('facebook') ||
      mensajeNorm.includes('face') ||
      mensajeNorm.includes('whatsapp') ||
      mensajeNorm.includes('redes sociales') ||
      mensajeNorm.includes('sus redes') ||
      mensajeNorm.includes('pagina') ||
      mensajeNorm.includes('página')
    ) {
      return {
        titulo: `Redes sociales de ${nombreLugar}`,
        mensaje: 'Puedes encontrar sus redes sociales y página web visitando su perfil dentro de Jelpy 📱',
      };
    }

    if (
      mensajeNorm.includes('estacionamiento') ||
      mensajeNorm.includes('parking') ||
      mensajeNorm.includes('donde estacionar') ||
      mensajeNorm.includes('accesible') ||
      mensajeNorm.includes('terraza') ||
      mensajeNorm.includes('area de ninos') ||
      mensajeNorm.includes('aire acondicionado')
    ) {
      return {
        titulo: `Instalaciones de ${nombreLugar}`,
        mensaje: 'Para conocer las instalaciones disponibles (estacionamiento, terraza, área de niños, etc.) te recomiendo visitar su perfil en Jelpy o llamar directamente.',
      };
    }

    if (
      mensajeNorm.includes('menu') ||
      mensajeNorm.includes('menú') ||
      mensajeNorm.includes('que venden') ||
      mensajeNorm.includes('que ofrecen') ||
      mensajeNorm.includes('que tienen') ||
      mensajeNorm.includes('su carta') ||
      mensajeNorm.includes('platillos')
    ) {
      return {
        titulo: `Menú de ${nombreLugar}`,
        mensaje: 'Puedes ver el menú completo y los productos disponibles en el perfil de Jelpy de este negocio 🍽️',
      };
    }

    if (
      mensajeNorm.includes('reservacion') ||
      mensajeNorm.includes('reservación') ||
      mensajeNorm.includes('reservar') ||
      mensajeNorm.includes('hay que reservar')
    ) {
      return {
        titulo: `Reservaciones en ${nombreLugar}`,
        mensaje: 'Para hacer una reservación o saber si es necesaria, te recomiendo llamar directamente al negocio 📞',
      };
    }

    // Detalle genérico
    return {
      titulo: `Sobre ${nombreLugar}`,
      mensaje: 'Puedo darte información sobre teléfono, horario, domicilio o promociones. ¿Qué quieres saber?',
    };
  }
}
