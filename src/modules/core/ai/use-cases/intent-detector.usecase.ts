import { Injectable } from '@nestjs/common';

@Injectable()
export class IntentDetectorUseCase {
  detect(text: string): 'chat' | 'search' {
    if (!text) return 'chat';

    const t = text.toLowerCase().trim();

    // ========================
    // CHAT NORMAL / SOCIAL
    // ========================
    const chatTriggers = [
      'hola', 'holi', 'hello', 'buenas', 'buen día', 'hey', 'ola', 'holaaa',
      'como estas', 'cómo estás', 'que tal', 'qué tal',
      'quien eres', 'qué eres', 'que eres', 'quien sos',
      'como te llamas', 'cual es tu nombre',
      'ayuda', 'una pregunta', 'tengo duda',
      'gracias', 'te agradezco',
      'de donde eres', 'donde vives',
      'cuentame algo', 'platiquemos', 'estás ahí',
      'no entiendo', 'repiteme', 'no se', 'nose', 'mmm', 'emm',
      'hazme un resumen', 'tarea', 'codigo', 'programacion'
    ];

    if (chatTriggers.some(f => t.includes(f))) {
      return 'chat';
    }

    // ========================
    // DETECCIÓN DE BÚSQUEDA
    // ========================
    const searchKeywords = [
      'busco', 'buscar', 'quiero', 'necesito',
      'donde', 'dónde', 'cerca', 'abierto',
      'promocion', 'promo', 'descuento',
      'tienda', 'servicio', 'doctor', 'restaurante',
      'sushi', 'pizza', 'tacos', 'farmacia', 'spa', 'barber'
    ];

    if (searchKeywords.some(f => t.includes(f))) {
      return 'search';
    }

    // Detectar búsqueda aunque sea sin verbo
    if (/sushi|pizza|tacos|farmacia|barber|spa/i.test(t)) {
      return 'search';
    }

    return 'chat';
  }
}
