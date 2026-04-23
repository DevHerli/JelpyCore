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
      'cuentame algo', 'platiquemos', 'estás ahí', 'estas ahi', 'estas ai',
      'no entiendo', 'repiteme', 'no se', 'nose', 'mmm', 'emm',
      'hazme un resumen', 'tarea', 'codigo', 'programacion','ey', 'ok google', 'ok jelpy', 'ok asistente', 'ok bot', 'ok ai',
      'olle', 'ole', 'holis', 'holiss', 'holisss', 'holissss', 'holisssss','ke onda', 'q onda', 'que onda', 'q tal', 'que tal', 
      'q haces', 'que haces', 'como va', 'como va todo', 
    ];

    if (chatTriggers.some(f => t.includes(f))) {
      return 'chat';
    }

    // ========================
    // DETECCIÓN DE BÚSQUEDA
    // ========================
const searchKeywords = [
  // ========================
  // INTENCIÓN / ACCIÓN
  // ========================
  'busco', 'buscar', 'quiero', 'necesito',
  'donde', 'dónde', 'cerca', 'abierto',
  'dame', 'recomienda', 'recomiendame',
  'sugerencia', 'sugiereme',

  // ========================
  // PROMOS / COMERCIAL
  // ========================
  'promocion', 'promo', 'promociones',
  'descuento', 'descuentos',
  'ofertas', 'cupones', 'rebajas',

  // ========================
  // COMIDA
  // ========================
  'restaurante',
  'sushi', 'pizza', 'tacos', 'alitas',
  'hamburguesas', 'mariscos', 'ceviches', 'aguachiles',
  'ensaladas', 'postres', 'helados',
  'cafe', 'cafeteria', 'cafes',
  'panaderia', 'pasteleria',
  'comida corrida', 'comida casera', 'comida rapida',
  'comida saludable', 'comida vegana', 'comida vegetariana',

  // ========================
  // SALUD 
  // ========================
  'doctor', 'doctora', 'medico', 'médico',
  'dentista', 'odontologo', 'odontólogo', 'odontologia',
  'pediatra', 'ginecologo', 'ginecólogo',
  'cardiologo', 'psicologo', 'dermatologo',
  'hospital', 'clinica', 'clínica',
  'farmacia', 'laboratorio',
  'dotor', 'dotora',

  // ========================
  // SERVICIOS PERSONALES
  // ========================
  'barber', 'barberia', 'barbería',
  'peluqueria', 'peluquería',
  'spa', 'gimnasio',

  // ========================
  // MASCOTAS
  // ========================
  'veterinaria', 'veterinario',
  'mascotas', 'adopcion',
  'paseador de perros', 'guarderia de mascotas',

  // ========================
  // COMERCIO / TIENDAS
  // ========================
  'tienda', 'servicio',
  'ropa', 'zapatos',
  'tecnologia', 'celulares', 'computadoras',
  'muebles', 'decoracion',
  'juguetes', 'regalos',
  'floreria', 'libreria', 'papeleria',
  'abarrotes', 'supermercado', 'mercado', 'abastos', 'abarrote',

  // ========================
  // ENTRETENIMIENTO
  // ========================
  'cine', 'pelicula',
  'concierto', 'evento', 'espectaculo',
  'teatro', 'musica en vivo',
  'bares', 'antros', 'clubes'
];

    if (searchKeywords.some(f => t.includes(f))) {
      return 'search';
    }

    // Detectar búsqueda aunque sea sin verbo
    if (/sushi|pizza|alitas|tacos|farmacia|barber|spa/i.test(t)) {
      return 'search';
    }

    return 'chat';
  }
}
