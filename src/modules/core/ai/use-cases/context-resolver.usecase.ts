import { Injectable } from '@nestjs/common';
import { ConversationSession } from '../../conversation/entities/conversation-session.entity';

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
  tipoSeguimiento?: 'referencia_item' | 'consulta_detalles' | 'busqueda_variante' | 'ninguno';
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

    const esTextoMuyCorto = textoNorm.split(' ').length <= 4;

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

    return sinContexto;
  }

  /**
   * Genera una respuesta de detalle cuando el usuario pregunta sobre
   * el primer resultado anterior sin hacer una búsqueda nueva.
   */
  generarRespuestaDetalle(
    mensajeNorm: string,
    item: any,
  ): { titulo: string; mensaje: string } | null {
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
      };
    }

    // Detalle genérico
    return {
      titulo: `Sobre ${nombreLugar}`,
      mensaje: 'Puedo darte información sobre teléfono, horario, domicilio o promociones. ¿Qué quieres saber?',
    };
  }
}
