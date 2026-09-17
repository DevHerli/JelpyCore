import { ConversationClassifier } from './conversation-classifier';

describe('ConversationClassifier', () => {
  it('clasifica un saludo como conversación, no como búsqueda', () => {
    const result = ConversationClassifier.classify('hola');

    expect(result.intent).toBe('small_talk');
    expect(result.route).toBe('chat');
    expect(result.chatIntent).toBe('saludo');
  });

  it('clasifica una búsqueda clara de negocio', () => {
    const result = ConversationClassifier.classify('busco tacos cerca de mí');

    expect(result.intent).toBe('business_search');
    expect(result.route).toBe('search');
    expect(result.containsBusinessTerm).toBe(true);
  });

  it('mantiene una frase mixta como búsqueda cuando contiene un negocio', () => {
    const result = ConversationClassifier.classify('hola quiero sushi');

    expect(result.intent).toBe('business_search');
    expect(result.route).toBe('search');
  });

  it('detecta refinamientos cuando ya hay contexto de búsqueda', () => {
    const result = ConversationClassifier.classify('más barato', {
      hasSearchContext: true,
    });

    expect(result.intent).toBe('search_refinement');
    expect(result.route).toBe('search');
  });

  it('clasifica preguntas de detalle sobre el resultado anterior', () => {
    const result = ConversationClassifier.classify('cuál es el teléfono?', {
      hasSearchContext: true,
    });

    expect(result.intent).toBe('business_detail_question');
    expect(result.route).toBe('search');
  });

  it('responde temas fuera de alcance desde la capa conversacional', () => {
    const result = ConversationClassifier.classify('hazme una tarea de química');

    expect(result.intent).toBe('out_of_scope');
    expect(result.route).toBe('chat');
  });

  it('pide aclaración para texto ambiguo', () => {
    const result = ConversationClassifier.classify('???');

    expect(result.intent).toBe('ambiguous');
    expect(result.route).toBe('clarify');
  });

  // --------------------------------------------------------------------
  // Suite de conversación (punto 6 del roadmap acordado con el usuario):
  // frases que Jelpy debe manejar siempre, sin importar qué tanto se
  // toque el pipeline alrededor. Sirve como red de regresión: si una
  // frase de esta lista cambia de clasificación sin que sea intencional,
  // el test falla ANTES de que el usuario lo note en producción.
  // --------------------------------------------------------------------
  describe('frases que Jelpy debe manejar siempre', () => {
    const casos: Array<{
      texto: string;
      intent: string;
      route: 'chat' | 'search' | 'clarify';
    }> = [
      { texto: 'hola', intent: 'small_talk', route: 'chat' },
      { texto: 'quién eres', intent: 'small_talk', route: 'chat' },
      { texto: 'qué puedes hacer', intent: 'small_talk', route: 'chat' },
      { texto: 'busco tacos', intent: 'business_search', route: 'search' },
      { texto: 'farmacia abierta', intent: 'business_search', route: 'search' },
      { texto: 'gracias', intent: 'small_talk', route: 'chat' },
      { texto: 'quiero hablar con alguien', intent: 'support_or_complaint', route: 'chat' },
    ];

    it.each(casos)('"$texto" → intent=$intent, route=$route', ({ texto, intent, route }) => {
      const result = ConversationClassifier.classify(texto);

      expect(result.intent).toBe(intent);
      expect(result.route).toBe(route);
    });

    it('"más barato" con contexto de búsqueda previo es un refinamiento, no una búsqueda nueva', () => {
      const result = ConversationClassifier.classify('más barato', { hasSearchContext: true });

      expect(result.intent).toBe('search_refinement');
      expect(result.route).toBe('search');
    });

    it('"cerca de mí" sin contexto previo no debe fallar (queda como chat/clarify, nunca lanza error)', () => {
      expect(() => ConversationClassifier.classify('cerca de mí')).not.toThrow();
    });

    it('"algo bonito" (mensaje realmente irreconocible) cae en clarify con chatIntent fallback, listo para Capa 2', () => {
      const result = ConversationClassifier.classify('algo bonito');

      expect(result.route).toBe('clarify');
      expect(result.chatIntent).toBe('fallback');
    });
  });

  // --------------------------------------------------------------------
  // JLP-PHONETIC-FIX: bug reportado por el usuario — "Kien erez" (typo
  // real, enviado desde la app) no se reconocía como "quién eres" y caía
  // en la pregunta guiada genérica de Capa 2 en vez de responder identidad.
  // Cubre las confusiones más comunes del español mexicano informal.
  // --------------------------------------------------------------------
  describe('tolerancia a faltas de ortografía (muchos usuarios en México escriben informal)', () => {
    it('"Kien erez" se reconoce como pregunta de identidad, no cae en clarify', () => {
      const result = ConversationClassifier.classify('Kien erez');

      expect(result.intent).toBe('small_talk');
      expect(result.route).toBe('chat');
      expect(result.chatIntent).toBe('identidad');
    });

    it('"busko farmasia" (typos) se reconoce como búsqueda de negocio', () => {
      const result = ConversationClassifier.classify('busko farmasia');

      expect(result.intent).toBe('business_search');
      expect(result.route).toBe('search');
      expect(result.containsBusinessTerm).toBe(true);
    });

    it('"nesesito dentista" (typos) se reconoce como búsqueda de negocio', () => {
      const result = ConversationClassifier.classify('nesesito dentista');

      expect(result.intent).toBe('business_search');
      expect(result.route).toBe('search');
    });

    it('"grasias" (typo de "gracias") se reconoce como small talk', () => {
      const result = ConversationClassifier.classify('grasias');

      expect(result.intent).toBe('small_talk');
      expect(result.route).toBe('chat');
      expect(result.chatIntent).toBe('gracias');
    });
  });

  // --------------------------------------------------------------------
  // Bug reportado por el usuario: "buenos días" producía respuestas "muy
  // incoherentes". Causa raíz: ChatResponses.detectarIntent() no
  // reconocía "buenos dias"/"buen dia"/"buenas tardes"/"buenas noches"
  // (solo "buenas" a secas), así que devolvía chatIntent='fallback'. Como
  // ConversationClassifier.classify() usa ese chatIntent, terminaba
  // clasificando el saludo como route='clarify', lo que en ai.service.ts
  // dispara la pregunta guiada genérica de Capa 2 en vez de saludar.
  // --------------------------------------------------------------------
  describe('saludos con franja horaria específica nunca caen en clarify (bug "buenos días" incoherente)', () => {
    const saludos = ['buenos dias', 'buen dia', 'buenas tardes', 'buenas noches'];

    it.each(saludos)('"%s" se clasifica como small_talk/chat, no como clarify', (texto) => {
      const result = ConversationClassifier.classify(texto);

      expect(result.intent).toBe('small_talk');
      expect(result.route).toBe('chat');
      expect(result.chatIntent).toBe('saludo');
    });
  });

  // --------------------------------------------------------------------
  // JLP-UMBRELLA-CONTEXTO-FIX: el usuario reportó que, tras buscar
  // "promociones sushi" y luego escribir solo "comida" (esperando ver
  // negocios de la categoría comida), Jelpy le devolvía la promoción de
  // sushi de la búsqueda anterior. Causa raíz (parte 2, en este archivo):
  // "comida"/"salud"/"belleza"/"servicios" son palabras SOMBRILLA — nunca
  // son `containsBusinessTerm` (no son alias de `JELPY_SEMANTIC_CATEGORIES`,
  // son categorías amplias) — así que, con una búsqueda anterior activa
  // (`hasSearchContext: true`, sin importar si es del mismo tema o no),
  // caían en la rama "asumir que es refinamiento" y se devolvía
  // `route: 'search'` en vez de `route: 'clarify'`. Eso evitaba por
  // completo la respuesta amigable de categoría sombrilla en `AiService`
  // (que solo se dispara cuando `route === 'clarify'` y
  // `chatIntent === 'fallback'`) y en su lugar disparaba una búsqueda real
  // que heredaba/ensuciaba el contexto anterior.
  // --------------------------------------------------------------------
  describe('palabras sombrilla (comida/salud/belleza/servicios) con contexto de búsqueda activo', () => {
    // "comida", "salud", "servicios"/"servicio" NO son alias de ninguna
    // categoría en `JELPY_SEMANTIC_CATEGORIES` (a propósito: son
    // categorías amplias, no negocios concretos), así que
    // `containsBusinessTerm` es `false` para ellas y son las que
    // necesitaban el guard de este fix.
    it.each(['comida', 'salud', 'servicios', 'servicio'])(
      '"%s" cae en clarify/fallback aunque haya una búsqueda anterior activa (no se trata como refinamiento)',
      (texto) => {
        const result = ConversationClassifier.classify(texto, { hasSearchContext: true });

        expect(result.route).toBe('clarify');
        expect(result.chatIntent).toBe('fallback');
        expect(result.intent).toBe('ambiguous');
      },
    );

    // "belleza" es un caso distinto: SÍ es un alias explícito de la
    // categoría "salones_belleza" en `JELPY_SEMANTIC_CATEGORIES`, así que
    // `containsBusinessTerm` es `true` y ya se clasifica como una
    // búsqueda de negocio real (más específico y mejor que la pregunta
    // guiada) desde antes de llegar a este guard — no necesitaba el fix.
    it('"belleza" (sí es alias de negocio) se clasifica como business_search/route search, con o sin contexto previo', () => {
      const result = ConversationClassifier.classify('belleza', { hasSearchContext: true });

      expect(result.route).toBe('search');
      expect(result.intent).toBe('business_search');
      expect(result.containsBusinessTerm).toBe(true);
    });

    it('sin contexto de búsqueda, "comida" también cae en clarify/fallback (comportamiento previo intacto)', () => {
      const result = ConversationClassifier.classify('comida');

      expect(result.route).toBe('clarify');
      expect(result.chatIntent).toBe('fallback');
    });

    it('un chip de seguimiento real (no sombrilla, ej. "más barato") sigue clasificándose como refinamiento de búsqueda', () => {
      const result = ConversationClassifier.classify('más barato', { hasSearchContext: true });

      expect(result.route).toBe('search');
      expect(result.intent).toBe('search_refinement');
    });
  });

  // --------------------------------------------------------------------
  // JLP-TIENDAS-UMBRELLA-FIX: el usuario reportó que "tiendas cerca"
  // respondía "No encontré 'tiendas' ¿Quisiste decir 'bandas'?" en vez de
  // reconocer que sí hay tiendas (abarrotes, ropa, etc.) registradas.
  // Causa raíz: "tiendas" es una palabra SOMBRILLA igual que
  // "comida"/"salud"/"belleza"/"servicios", pero antes de este fix un
  // verbo de búsqueda explícito ("quiero tiendas cerca") la hacía pasar
  // por el bloque `tieneVerboBusqueda` ANTES de llegar al guard de
  // sombrillas (que solo corría al final, como último recurso) —
  // disparando una búsqueda real que fallaba y terminaba en una
  // corrección ortográfica absurda (mismo bug ya visto con "quiero
  // comida cerca" → "¿Quisiste decir 'cocido'?"). Ahora el guard de
  // sombrillas corre ANTES que el de verbos de búsqueda, así que ninguna
  // palabra sombrilla se convierte en búsqueda real sin importar el verbo.
  // --------------------------------------------------------------------
  describe('palabra sombrilla "tiendas" (JLP-TIENDAS-UMBRELLA-FIX)', () => {
    it('"tiendas cerca" cae en clarify/fallback, no en búsqueda real', () => {
      const result = ConversationClassifier.classify('tiendas cerca');

      expect(result.route).toBe('clarify');
      expect(result.chatIntent).toBe('fallback');
      expect(result.intent).toBe('ambiguous');
      expect(result.containsBusinessTerm).toBe(false);
    });

    it('"tiendas cerca" con contexto de búsqueda previo también cae en clarify (no hereda la búsqueda anterior)', () => {
      const result = ConversationClassifier.classify('tiendas cerca', { hasSearchContext: true });

      expect(result.route).toBe('clarify');
      expect(result.intent).toBe('ambiguous');
    });

    it.each(['quiero tiendas cerca', 'busco tiendas cerca', 'necesito una tienda'])(
      '"%s" (verbo de búsqueda + sombrilla) NUNCA se convierte en búsqueda real: cae en clarify',
      (texto) => {
        const result = ConversationClassifier.classify(texto);

        expect(result.route).toBe('clarify');
        expect(result.intent).toBe('ambiguous');
      },
    );

    it('el mismo guard protege también a "comida"/"salud" cuando llevan un verbo de búsqueda explícito', () => {
      const comida = ConversationClassifier.classify('quiero comida cerca');
      const salud = ConversationClassifier.classify('busco salud cerca');

      expect(comida.route).toBe('clarify');
      expect(salud.route).toBe('clarify');
    });
  });
});
