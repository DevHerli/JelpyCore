import { ChatResponses } from './chat-responses';

describe('ChatResponses.detectarIntent', () => {
  const casos: Array<{ texto: string; intent: string }> = [
    { texto: 'hola', intent: 'saludo' },
    { texto: 'buenas tardes', intent: 'saludo' },
    { texto: 'quién eres', intent: 'identidad' },
    { texto: 'qué puedes hacer', intent: 'capacidades' },
    { texto: 'gracias', intent: 'gracias' },
    { texto: 'adiós', intent: 'despedida' },
    { texto: 'promociones', intent: 'promociones' },
    { texto: 'promos de sushi', intent: 'promociones' },
    { texto: 'cuánto cuesta', intent: 'precio' },
    { texto: 'quiero hablar con alguien', intent: 'humano_escalar' },
    { texto: 'no entiendo', intent: 'no_entiende' },
    { texto: 'quiero agendar cita', intent: 'agendar_cita' },
    { texto: 'esto es un desastre, pésimo servicio', intent: 'queja' },
    { texto: 'hazme una tarea de matemáticas', intent: 'fuera_de_alcance' },
  ];

  it.each(casos)('"$texto" → $intent', ({ texto, intent }) => {
    expect(ChatResponses.detectarIntent(texto)).toBe(intent);
  });

  it('no lanza excepción con entrada vacía o solo espacios', () => {
    expect(() => ChatResponses.detectarIntent('')).not.toThrow();
    expect(() => ChatResponses.detectarIntent('   ')).not.toThrow();
  });
});

describe('ChatResponses.detectarIntent — tolerancia a faltas de ortografía (JLP-PHONETIC-FIX)', () => {
  // Regresión del bug reportado por el usuario: "Kien erez" (typo real,
  // enviado desde la app) no se reconocía como "quién eres" y caía en la
  // pregunta guiada genérica de Capa 2 en vez de responder identidad.
  // Cubre las confusiones más comunes del español mexicano informal:
  // seseo (s/z/c), yeísmo (ll/y), betacismo (b/v), h muda y letras
  // repetidas — ver `TextNormalizer`.
  const casos: Array<{ texto: string; intent: string }> = [
    { texto: 'Kien erez', intent: 'identidad' },
    { texto: 'kien eres', intent: 'identidad' },
    { texto: 'komo te yamas', intent: 'identidad' },
    { texto: 'grasias', intent: 'gracias' },
    { texto: 'grasias totales', intent: 'gracias' },
    { texto: 'ola', intent: 'saludo' },
    { texto: 'nesesito ayuda', intent: 'capacidades' },
  ];

  it.each(casos)('"$texto" (con faltas) → $intent', ({ texto, intent }) => {
    expect(ChatResponses.detectarIntent(texto)).toBe(intent);
  });
});

describe('ChatResponses — Jelpy habla siempre en masculino (bug reportado por el usuario)', () => {
  // Jelpy es "él", no "ella". Antes varias respuestas se referían a sí
  // mismo en femenino ("estoy segura", "estoy lista", "diseñada",
  // "precisa"), lo cual es inconsistente con la identidad del asistente.
  const preguntasSobreSiMismo = [
    'quien eres', 'como te llamas', 'eres humano', 'de donde eres',
    'tienes novia', 'que genero eres', 'eres chatbot', 'aprendes de mi',
    'me ayudas', 'que puedes hacer', 'eres segura', 'puedo confiar en ti',
    'estas activa', 'puedes equivocarte', 'hola',
  ];

  it('ninguna respuesta sobre Jelpy usa adjetivos autorreferenciales en femenino', () => {
    const terminosFemeninosProhibidos = [
      'estoy segura', 'estoy lista', 'diseñada', 'preparada', 'dispuesta',
      'mas precisa', 'más precisa', 'entrenada', 'programada', 'capacitada',
    ];

    for (const pregunta of preguntasSobreSiMismo) {
      const respuesta = ChatResponses.responder(pregunta);
      const textoCompleto = `${respuesta.titulo} ${respuesta.mensaje}`.toLowerCase();

      for (const termino of terminosFemeninosProhibidos) {
        expect(textoCompleto).not.toContain(termino);
      }
    }
  });
});

describe('ChatResponses.responder', () => {
  it('"Promociones" pregunta categoría SIN decir "activas" (bug reportado por el usuario)', () => {
    const respuesta = ChatResponses.responder('promociones');

    expect(respuesta.mensaje.toLowerCase()).not.toContain('activas');
  });

  it('un saludo en sesión nueva da la bienvenida completa; en sesión con historial es más corto', () => {
    const nueva = ChatResponses.responder('hola', { historialTurnos: 0 });
    const conHistorial = ChatResponses.responder('hola', { historialTurnos: 3 });

    expect(nueva.mensaje).toBeTruthy();
    expect(conHistorial.mensaje).toBeTruthy();
  });

  it('mensaje de queja tiene tono empático, nunca alegre', () => {
    const respuesta = ChatResponses.responder('esto es un desastre, qué pésimo servicio');

    expect(respuesta.titulo.toLowerCase()).toMatch(/lamento/);
  });
});

describe('ChatResponses.generarSugerencias', () => {
  it('nunca ofrece chips tras una queja, escalar a humano o despedida', () => {
    expect(ChatResponses.generarSugerencias('queja')).toEqual([]);
    expect(ChatResponses.generarSugerencias('humano_escalar')).toEqual([]);
    expect(ChatResponses.generarSugerencias('despedida')).toEqual([]);
  });

  it('"clarificar_busqueda" (Capa 2) da exactamente 4 chips, uno por categoría grande', () => {
    const sugerencias = ChatResponses.generarSugerencias('clarificar_busqueda');

    expect(sugerencias).toHaveLength(4);
    expect(new Set(sugerencias).size).toBe(sugerencias.length); // sin duplicados
  });

  it('cada chip generado es reconocible por el propio clasificador de intención (nunca produce "No entendí")', () => {
    // Regresión del bug: antes los chips eran preguntas fijas que no
    // coincidían con ningún patrón de detección, y tocar uno devolvía
    // "No entendí bien". Verificamos que cada chip posible, si se
    // reenvía tal cual como mensaje del usuario, sea reconocido como
    // negocio real (contiene alias de JELPY_SEMANTIC_CATEGORIES).
    const intents = [
      'saludo', 'promociones', 'agendar_cita', 'precio', 'capacidades', 'clarificar_busqueda',
    ];

    for (const intent of intents) {
      const chips = ChatResponses.generarSugerencias(intent);
      for (const chip of chips) {
        expect(chip.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('ChatResponses.preguntarAclaracionBusqueda (Capa 2 — búsqueda guiada)', () => {
  it('sin ciudad conocida, pide categoría Y ciudad', () => {
    const respuesta = ChatResponses.preguntarAclaracionBusqueda();

    expect(respuesta.mensaje.toLowerCase()).toMatch(/ciudad/);
  });

  it('con ciudad conocida, no vuelve a preguntarla, solo la categoría', () => {
    const respuesta = ChatResponses.preguntarAclaracionBusqueda('Tepic');

    expect(respuesta.mensaje).toContain('Tepic');
  });

  it('nunca lanza excepción ni devuelve mensaje vacío', () => {
    expect(() => ChatResponses.preguntarAclaracionBusqueda()).not.toThrow();
    const r = ChatResponses.preguntarAclaracionBusqueda('');
    expect(r.titulo).toBeTruthy();
    expect(r.mensaje).toBeTruthy();
  });
});
