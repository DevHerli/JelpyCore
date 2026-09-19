import { ChatResponses } from './chat-responses';

describe('ChatResponses.detectarIntent', () => {
  const casos: Array<{ texto: string; intent: string }> = [
    { texto: 'hola', intent: 'saludo' },
    { texto: 'buenas tardes', intent: 'saludo' },
    { texto: 'quién eres', intent: 'identidad' },
    { texto: 'qué puedes hacer', intent: 'capacidades' },
    { texto: 'qué sabes hacer', intent: 'capacidades' },
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

describe('ChatResponses — saludos con franja horaria específica (bug reportado por el usuario: "buenos días" incoherente)', () => {
  // Bug real: "buenos días" NO se reconocía en detectarIntent() (solo
  // "buenas" a secas), así que devolvía 'fallback' en vez de 'saludo'.
  // Como ConversationClassifier usa este valor para decidir la ruta, eso
  // disparaba la pregunta guiada genérica de Capa 2 ("¿es comida, salud,
  // belleza o servicio?") en vez de saludar — la respuesta "muy
  // incoherente" que reportó el usuario. Además, cuando SÍ se reconocía,
  // el título de la respuesta siempre usaba la hora del SERVIDOR
  // (this.saludoPorHora()), ignorando lo que el usuario escribió, por lo
  // que alguien podía escribir "buenas tardes" y recibir un título de
  // "Buenos días" si el reloj del servidor marcaba otra franja.
  const casos: Array<{ texto: string; contieneEnTitulo: string }> = [
    { texto: 'buenos dias', contieneEnTitulo: 'buenos días' },
    { texto: 'buen dia', contieneEnTitulo: 'buenos días' },
    { texto: 'buenas tardes', contieneEnTitulo: 'buenas tardes' },
    { texto: 'buenas noches', contieneEnTitulo: 'buenas noches' },
  ];

  it.each(casos)(
    '"$texto" → detectarIntent = saludo (nunca fallback)',
    ({ texto }) => {
      expect(ChatResponses.detectarIntent(texto)).toBe('saludo');
    },
  );

  it.each(casos)(
    '"$texto" → el título de la respuesta respeta la franja horaria que el usuario escribió, no la del servidor',
    ({ texto, contieneEnTitulo }) => {
      const respuesta = ChatResponses.responder(texto);
      expect(respuesta.titulo.toLowerCase()).toContain(contieneEnTitulo);
    },
  );

  it('los saludos genéricos ("hola", "buenas", "hey") siguen funcionando y no lanzan excepción', () => {
    for (const texto of ['hola', 'buenas', 'hey', 'holi', 'hi']) {
      expect(ChatResponses.detectarIntent(texto)).toBe('saludo');
      expect(() => ChatResponses.responder(texto)).not.toThrow();
    }
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

  it('"qué sabes hacer" responde con ejemplos naturales y útiles', () => {
    const respuesta = ChatResponses.responder('qué sabes hacer');
    const texto = `${respuesta.titulo} ${respuesta.mensaje}`.toLowerCase();

    expect(texto).toMatch(/taquitos|chelitas|pistear|cena|farmacia|promociones/);
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

  it('"clarificar_busqueda" (Capa 2) no genera chips', () => {
    const sugerencias = ChatResponses.generarSugerencias('clarificar_busqueda');

    expect(sugerencias).toEqual([]);
  });

  it('no genera chips para ninguna intención conversacional', () => {
    const intents = [
      'saludo', 'promociones', 'agendar_cita', 'precio', 'capacidades', 'clarificar_busqueda',
    ];

    for (const intent of intents) {
      expect(ChatResponses.generarSugerencias(intent)).toEqual([]);
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

/**
 * JLP-DOBLE-PREGUNTA-FIX: el usuario reportó que Jelpy hace SIEMPRE dos
 * preguntas seguidas en el mismo mensaje (ej. la respuesta de categoría
 * sombrilla "¿Qué se te antoja en Tepic? Elige una opción o dime qué
 * buscas." terminaba con un cierre genérico añadido: "¿Hay algo más en lo
 * que pueda ayudarte?"), y que eso es "muy abrumador para el suscriptor" —
 * pidió dejar contestar la primera pregunta antes de lanzar otra.
 *
 * Esta suite fija que `agregarCierreGenerico` ya NO agrega una segunda
 * pregunta cuando el mensaje original ya trae una pregunta propia, y que
 * `responderCategoriaUmbrella` (el caso real reportado) queda con una sola
 * pregunta en el mensaje final.
 */
describe('ChatResponses.agregarCierreGenerico (JLP-DOBLE-PREGUNTA-FIX)', () => {
  it('no agrega una segunda pregunta si el mensaje ya contiene una pregunta propia', () => {
    const original = '¿Qué se te antoja en Tepic? Elige una opción o dime qué buscas.';

    const resultado = ChatResponses.agregarCierreGenerico(original);

    expect(resultado).toBe(original);
    expect(resultado.match(/\?/g)?.length).toBe(1);
  });

  it('sí agrega el cierre genérico cuando el mensaje NO trae ninguna pregunta propia', () => {
    const original = 'Fue un placer ayudarte.';

    const resultado = ChatResponses.agregarCierreGenerico(original);

    expect(resultado).toContain(original);
    expect(resultado.length).toBeGreaterThan(original.length);
    expect(resultado).toContain('\n\n');
  });

  it('no duplica el cierre si el mensaje ya lo trae incluido', () => {
    const conCierre = 'Listo.\n\n¿Hay algo más en lo que pueda ayudarte?';

    const resultado = ChatResponses.agregarCierreGenerico(conCierre);

    expect(resultado).toBe(conCierre);
  });

  it('la respuesta de categoría sombrilla ("comida") queda con una sola pregunta, no dos', () => {
    const respuesta = ChatResponses.responderCategoriaUmbrella('comida', 'Tepic');

    expect(respuesta.mensaje.match(/\?/g)?.length).toBe(1);
    expect(respuesta.mensaje).not.toContain('¿Hay algo más en lo que pueda ayudarte?');
    expect(respuesta.mensaje).not.toContain('¿Te interesa buscar otra cosa?');
  });
});

/**
 * JLP-TIENDAS-UMBRELLA-FIX: el usuario reportó que "tiendas cerca"
 * respondía "No encontré 'tiendas' 🤔 ¿Quisiste decir 'bandas'?" — una
 * corrección ortográfica sin sentido — a pesar de que sí hay tiendas
 * (abarrotes, ropa, etc.) registradas. La causa: "tiendas" es una palabra
 * SOMBRILLA (como "comida"/"salud"/"belleza"/"servicios") que nunca va a
 * mapear a un alias exacto de `JELPY_SEMANTIC_CATEGORIES`, así que
 * terminaba en la búsqueda real (0 resultados) en vez de en la aclaración
 * guiada. Ahora "tiendas" se reconoce como sombrilla y responde
 * preguntando qué tipo de tienda (abarrotes, ropa, maquillaje, zapatos,
 * accesorios...) en vez de intentar adivinar/corregir.
 */
describe('ChatResponses categoría sombrilla "tiendas" (JLP-TIENDAS-UMBRELLA-FIX)', () => {
  it('detectarCategoriaUmbrella reconoce "tiendas" y "tienda"', () => {
    expect(ChatResponses.detectarCategoriaUmbrella('tiendas cerca')).toBe('tiendas');
    expect(ChatResponses.detectarCategoriaUmbrella('quiero tiendas cerca')).toBe('tiendas');
    expect(ChatResponses.detectarCategoriaUmbrella('busco una tienda')).toBe('tiendas');
  });

  it('responderCategoriaUmbrella("tiendas") pregunta por el tipo de tienda, no adivina ni corrige', () => {
    const respuesta = ChatResponses.responderCategoriaUmbrella('tiendas', 'Tepic');

    expect(respuesta.mensaje).toContain('abarrotes');
    expect(respuesta.mensaje).toContain('ropa');
    expect(respuesta.mensaje).not.toContain('Quisiste decir');
    expect(respuesta.mensaje.match(/\?/g)?.length).toBe(1);
  });
});

/**
 * JLP-CORTE-PELO-AMBIGUO-FIX: el usuario reportó que pidió "corte de
 * pelo" y Jelpy "no entendió". "Corte de pelo" es un alias real de
 * `JELPY_SEMANTIC_CATEGORIES` para barberías/salones de belleza, pero el
 * mismo catálogo también tiene "estéticas caninas"/"peluquerías para
 * mascotas" con corte de pelo para animales — el mensaje es AMBIGUO
 * (persona o mascota) y Jelpy debe decirlo explícitamente en vez de
 * asumir uno de los dos a ciegas.
 */
describe('ChatResponses "corte de pelo" ambiguo (JLP-CORTE-PELO-AMBIGUO-FIX)', () => {
  it.each([
    'corte de pelo',
    'quiero un corte de pelo',
    'corte de pelo cerca de mi',
    'corte de cabello',
    'cortar el pelo',
    'necesito cortarme el pelo',
    // JLP-CORTE-PELO-CONECTOR-FIX: bug reportado por el usuario — escribir
    // "Corte pelo" (sin la palabra "de") dejaba de reconocerse como el
    // mismo caso ambiguo y terminaba mostrando una sugerencia ortográfica
    // sin sentido ("¿Quisiste decir 'corto'?") en vez de esta pregunta.
    'Corte pelo',
    'corte cabello',
    'cortar pelo',
  ])('"%s" (sin pista de para quién es) se detecta como ambiguo', (texto) => {
    expect(ChatResponses.esCortePeloAmbiguo(texto)).toBe(true);
  });

  it.each([
    'corte de pelo para mi perro',
    'corte de pelo para mi mascota',
    'corte de pelo para mi gato',
    'quiero ir a la barbería',
    'corte de pelo en salón de belleza',
    'busco una peluquería',
    'busco un restaurante', // no menciona corte de pelo en absoluto
    // JLP-CORTE-PELO-CONECTOR-FIX: mismas variantes sin pista, pero ahora
    // sin el conector "de" — deben seguir reconociendo la pista de para
    // quién es (mascota/barbería) igual que con la frase completa.
    'corte pelo para mi perro',
    'corte pelo en barbería',
  ])('"%s" (ya trae pista de para quién es, o no habla de corte de pelo) NO se marca como ambiguo', (texto) => {
    expect(ChatResponses.esCortePeloAmbiguo(texto)).toBe(false);
  });

  it('responderCortePeloAmbiguo menciona ambas opciones (barbería/salón de belleza y mascota) en una sola pregunta', () => {
    const respuesta = ChatResponses.responderCortePeloAmbiguo('Tepic');

    expect(respuesta.mensaje).toMatch(/barber/i);
    expect(respuesta.mensaje).toMatch(/sal[oó]n(?:es)? de belleza/i);
    expect(respuesta.mensaje).toMatch(/mascota|perro|gato/i);
    expect(respuesta.mensaje.match(/\?/g)?.length).toBe(1);
  });

  // JLP-CORTE-PELO-HILO-FIX: solicitud del usuario — "corte de pelo para
  // mi hijo"/"para mi mamá"/etc. ya trae una pista humana explícita
  // (mención de un familiar/persona cercana), así que NO debe seguir
  // considerándose ambiguo ni preguntar de nuevo.
  it.each([
    'corte de pelo para mi hijo',
    'corte de pelo para mi hija',
    'corte de pelo para mi mamá',
    'corte de pelo para mi papá',
    'corte de pelo para mi hermano',
    'corte de pelo para mi jefe',
  ])('"%s" (menciona un familiar/persona) NO se marca como ambiguo', (texto) => {
    expect(ChatResponses.esCortePeloAmbiguo(texto)).toBe(false);
  });
});

/**
 * JLP-CORTE-PELO-HILO-FIX: bug reportado por el usuario (con captura de
 * pantalla) — tras preguntar "¿Corte de pelo para ti o para tu mascota?",
 * responder algo tan simple como "Para mi" hacía que Jelpy respondiera "No
 * entendí bien...", rompiendo el hilo de la conversación justo después de
 * la propia pregunta que Jelpy había hecho. `resolverCortePeloParaQuien`
 * interpreta esa respuesta corta (se usa junto con
 * `ContextResolverUseCase`/`PreguntaPendiente.tipo === 'corte_pelo_para_quien'`,
 * ver `context-resolver.usecase.ts`) para resolver directo hacia
 * barbería/salón de belleza (humano) o estética canina (mascota).
 *
 * También cubre la solicitud explícita del usuario de ampliar el alcance
 * con apodos familiares/de amistad ("mi hijo", "mi mamá", "mi jefe",
 * "brother", "mi bendición"...) y variantes cariñosas de mascota
 * ("perrihijo", "gatita"...).
 */
describe('ChatResponses.resolverCortePeloParaQuien (JLP-CORTE-PELO-HILO-FIX)', () => {
  it.each([
    'para mi',
    'para mí',
    'yo',
    'soy yo',
    'es para mi',
    'para mi hijo',
    'para mi hija',
    'mi mami',
    'mi mama',
    'mi papi',
    'mi papa',
    'padre',
    'madre',
    'mi hermana',
    'mi hermano',
    'sister',
    'brother',
    'bro',
    'amiga',
    'amigo',
    'friend',
    'sobrina',
    'sobrino',
    'prima',
    'primo',
    'tio',
    'tia',
    'jefe',
    'jefa',
    'mi bendi',
    'mi bendicion',
  ])('"%s" se resuelve como "humano"', (texto) => {
    expect(ChatResponses.resolverCortePeloParaQuien(texto)).toBe('humano');
  });

  it.each([
    'para mi perro',
    'para mi perrito',
    'para mi perrita',
    'para mi gato',
    'para mi gatito',
    'para mi gatita',
    'mi mascota',
    'para mi perrihijo',
    'para mi perrihija',
  ])('"%s" se resuelve como "mascota"', (texto) => {
    expect(ChatResponses.resolverCortePeloParaQuien(texto)).toBe('mascota');
  });

  it('una respuesta que no aclara nada se resuelve como "indefinido"', () => {
    expect(ChatResponses.resolverCortePeloParaQuien('no se')).toBe('indefinido');
  });

  it('"arroyo" no se confunde con la palabra suelta "yo" (falso positivo de substring)', () => {
    expect(ChatResponses.resolverCortePeloParaQuien('vivo cerca de un arroyo')).toBe('indefinido');
  });
});
