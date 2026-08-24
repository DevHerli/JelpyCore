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
});
