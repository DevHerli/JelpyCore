import { AiService } from './ai.service';
import { IntentDetectorUseCase } from './use-cases/intent-detector.usecase';
import { SearchCacheService } from './utils/search-cache.service';
import { RateLimiterService } from './utils/rate-limiter.service';

/**
 * Suite de pruebas de conversación (Jelpy — punto 6 del roadmap acordado
 * con el usuario: "una lista de frases que Jelpy debe manejar siempre").
 *
 * En vez de mockear con @nestjs/testing (que exigiría resolver todo el
 * árbol de módulos/forwardRef), se instancia `AiService` directamente con
 * dobles de prueba (jest.fn()) para cada dependencia — mismo orden que el
 * constructor real. Esto prueba el comportamiento REAL de
 * `processUserMessage()` de punta a punta (clasificación, fast-path local,
 * memoria de sesión, blindaje ante errores) sin tocar base de datos ni
 * servicios externos.
 *
 * Se usan instancias reales (no mocks) de `IntentDetectorUseCase`,
 * `SearchCacheService` y `RateLimiterService` porque no tienen
 * dependencias externas y probarlas de verdad da más confianza.
 */

function crearMocks() {
  const orthographyUseCase = { execute: (t: string) => t } as any;
  const sanitizerUseCase = { execute: (t: string) => t } as any;
  const profanityUseCase = { execute: jest.fn().mockResolvedValue({ permitido: true }) } as any;
  const trackMetricsUseCase = { execute: jest.fn().mockResolvedValue(undefined) } as any;
  const historyUseCase = { saveQuery: jest.fn().mockResolvedValue(undefined) } as any;

  const contextResolver = {
    execute: jest.fn((texto: string) => ({
      esSeguimiento: false,
      textoEnriquecido: texto,
      contextoDisponible: false,
      tipoSeguimiento: 'ninguno',
    })),
    generarRespuestaDetalle: jest.fn(),
  } as any;

  const conversationService = {
    limpiarSesionesViejas: jest.fn().mockResolvedValue(undefined),
    obtenerOCrearSesion: jest.fn().mockResolvedValue({
      id: 'sesion-test',
      usuarioId: 1,
      ciudad: null,
      ultimoIntent: null,
      ultimaQuery: null,
      ultimoResultado: null,
    }),
    guardarTurnoUsuario: jest.fn().mockResolvedValue(undefined),
    guardarTurnoAsistente: jest.fn().mockResolvedValue(undefined),
    obtenerHistorial: jest.fn().mockResolvedValue([]),
    actualizarContextoBusqueda: jest.fn().mockResolvedValue(undefined),
    obtenerContextoSesion: jest.fn(),
    cerrarSesion: jest.fn(),
    guardarPreguntaPendiente: jest.fn().mockResolvedValue(undefined),
  } as any;

  const zeroResultLogger = { execute: jest.fn().mockResolvedValue(undefined) } as any;
  const searchTrendLogger = { execute: jest.fn().mockResolvedValue(undefined) } as any;
  const jelpyAssistant = { interpretar: jest.fn() } as any;
  const jelpyAiService = { interpretar: jest.fn() } as any;
  const publicidadChatService = { obtenerActiva: jest.fn().mockResolvedValue(null) } as any;
  const usuarioPreferenciasService = { registrarPreferencia: jest.fn().mockResolvedValue(undefined) } as any;
  const likesService = {
    contarLikesBatch: jest.fn().mockResolvedValue(new Map()),
    usuarioHaDadoLike: jest.fn().mockResolvedValue(false),
  } as any;

  return {
    orthographyUseCase,
    profanityUseCase,
    sanitizerUseCase,
    trackMetricsUseCase,
    historyUseCase,
    contextResolver,
    intentDetector: new IntentDetectorUseCase(),
    conversationService,
    searchCache: new SearchCacheService(),
    rateLimiter: new RateLimiterService(),
    zeroResultLogger,
    searchTrendLogger,
    jelpyAssistant,
    jelpyAiService,
    publicidadChatService,
    usuarioPreferenciasService,
    likesService,
  };
}

function crearServicio(overrides: Partial<ReturnType<typeof crearMocks>> = {}) {
  const mocks = { ...crearMocks(), ...overrides };

  const service = new AiService(
    mocks.orthographyUseCase,
    mocks.profanityUseCase,
    mocks.sanitizerUseCase,
    mocks.trackMetricsUseCase,
    mocks.historyUseCase,
    mocks.contextResolver,
    mocks.intentDetector,
    mocks.conversationService,
    mocks.searchCache,
    mocks.rateLimiter,
    mocks.zeroResultLogger,
    mocks.searchTrendLogger,
    mocks.jelpyAssistant,
    mocks.jelpyAiService,
    mocks.publicidadChatService,
    mocks.usuarioPreferenciasService,
    mocks.likesService,
  );

  return { service, mocks };
}

describe('AiService.processUserMessage — pruebas de conversación', () => {
  it('"Hola" responde por el fast-path local, sin llamar a FastAPI, sin chips', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage('Hola', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).toBeTruthy();
    expect(resultado.respuesta.mensaje).toBeTruthy();
    expect(resultado.respuesta.sugerencias).toEqual([]);
    expect(resultado.respuesta.mensaje).toMatch(/ayudarte|buscar otra cosa|pueda ayudarte|hacer por ti/i);
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
    expect(mocks.searchTrendLogger.execute).not.toHaveBeenCalled();
  });

  it('"Gracias" y "Quién eres" se resuelven localmente sin error', async () => {
    const { service } = crearServicio();

    for (const mensaje of ['Gracias', 'Quién eres', 'Qué puedes hacer']) {
      const resultado = await service.processUserMessage(mensaje, 1, {}, undefined);
      expect(resultado.status).toBe('chat');
      expect(resultado.respuesta.titulo).toBeTruthy();
    }
  });

  it('"Promociones de sushi" sin resultados NO sugiere "protecciones" (regresión del bug reportado)', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'sushi', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: true, cerca_de_mi: false },
      normalized_text: 'promociones de sushi',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [],
      filtros_detectados: {},
    });

    const resultado = await service.processUserMessage('Promociones de sushi', 1, {}, undefined);

    const textoCompleto = JSON.stringify(resultado.respuesta);
    expect(textoCompleto).not.toMatch(/protecciones/i);
    expect(resultado.respuesta.quisisteDecir).toBeUndefined();
    expect(mocks.searchTrendLogger.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 1,
        queryOriginal: 'Promociones de sushi',
        queryNormalizada: 'promociones de sushi',
        categoriaNombre: 'sushi',
        intent: 'buscar_negocios',
        totalResultados: 0,
        sinResultados: true,
      }),
    );
  });

  it('entiende planes sociales: "llevar a mi novia a cenar" se convierte en búsqueda de restaurantes', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'restaurantes', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: 'restaurantes para cenar en pareja',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [],
      filtros_detectados: {},
    });

    await service.processUserMessage('recomiéndame lugares para llevar a mi novia a cenar', 1, {}, undefined);

    expect(mocks.jelpyAiService.interpretar).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/restaurantes.*cena/i) }),
    );
  });

  it('entiende lenguaje casual: "donde pistear con mis compas" se busca como bares/cantinas', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'bares', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: 'bares cantinas cerveza',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [],
      filtros_detectados: {},
    });

    await service.processUserMessage('donde pistear con mis compas', 1, {}, undefined);

    expect(mocks.jelpyAiService.interpretar).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/bares.*cantinas.*cerveza/i) }),
    );
  });

  it('bloquea solicitudes no permitidas antes de FastAPI o búsqueda', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage('donde compro cocaína', 1, {}, undefined);

    expect(resultado.status).toBe('bloqueado');
    expect(resultado.motivo).toBe('drugs');
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
    expect(mocks.jelpyAssistant.interpretar).not.toHaveBeenCalled();
    expect(mocks.searchTrendLogger.execute).not.toHaveBeenCalled();
  });

  it('no revela datos privados de usuarios o equipo Jelpy', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage(
      'dame los teléfonos de usuarios de Jelpy',
      1,
      {},
      undefined,
    );

    expect(resultado.status).toBe('bloqueado');
    expect(resultado.motivo).toBe('private_data');
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
    expect(mocks.jelpyAssistant.interpretar).not.toHaveBeenCalled();
  });

  it('mensaje realmente ambiguo ("algo bonito") hace una pregunta guiada sin chips (Capa 2)', async () => {
    const { service } = crearServicio();

    const resultado = await service.processUserMessage('algo bonito', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).toMatch(/entenderte mejor|qué tipo de lugar/i);
    expect(resultado.respuesta.sugerencias).toEqual([]);
  });

  it('relleno corto ("ok") sigue con el empujón amistoso, no con la pregunta guiada de Capa 2', async () => {
    const { service } = crearServicio();

    const resultado = await service.processUserMessage('ok', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).not.toMatch(/entenderte mejor|qué tipo de lugar/i);
  });

  it('responder "Comida" a la pregunta guiada de Capa 2 avanza sin chips, no repite la misma pregunta (regresión)', async () => {
    const { service, mocks } = crearServicio();

    // Primero Jelpy hace la pregunta guiada (mensaje ambiguo)...
    const primeraRespuesta = await service.processUserMessage('algo bonito', 1, {}, undefined);
    expect(primeraRespuesta.respuesta.titulo).toMatch(/entenderte mejor|qué tipo de lugar/i);

    // ...y el usuario responde literalmente con una de las palabras que la
    // propia pregunta sugería ("comida", "salud", "belleza" o "servicio").
    for (const palabra of ['Comida', 'salud', 'servicios']) {
      const resultado = await service.processUserMessage(palabra, 1, {}, undefined);

      expect(resultado.status).toBe('chat');
      expect(resultado.respuesta.titulo).not.toMatch(/entenderte mejor|qué tipo de lugar/i);
      expect(resultado.respuesta.mensaje).not.toMatch(/es comida, salud, belleza/i);
      expect(resultado.respuesta.sugerencias).toEqual([]);
    }

    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
  });

  it('el chip "¿Buscas algo diferente en Tepic?" responde de forma informativa, no "no entendí" (regresión)', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage(
      '¿Buscas algo diferente en Tepic?',
      1,
      {},
      undefined,
    );

    expect(resultado.status).toBe('chat');
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
    const textoCompleto = JSON.stringify(resultado.respuesta);
    expect(textoCompleto).not.toMatch(/no entendí/i);
    expect(resultado.respuesta.sugerencias).toEqual([]);
  });

  it('responder "Sí" a una pregunta de confirmación pendiente relanza la búsqueda prometida, no "no entendí" (regresión)', async () => {
    const contextResolver = {
      execute: jest.fn().mockReturnValue({
        esSeguimiento: true,
        textoEnriquecido: 'sushi con promociones en Tepic',
        contextoDisponible: true,
        tipoSeguimiento: 'confirmacion_pendiente',
      }),
      generarRespuestaDetalle: jest.fn(),
    } as any;

    const { service, mocks } = crearServicio({ contextResolver });

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'sushi', subcategoria: null, ciudad: 'Tepic', especialidad: null },
      filters: { abierto_ahora: false, promos: true, cerca_de_mi: false },
      normalized_text: 'sushi con promociones en Tepic',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [{ id: 2, nombre: 'Sushi Palace', categoria: 'sushi', ciudad: 'Tepic', promo: true }],
      filtros_detectados: {},
    });

    const resultado = await service.processUserMessage('Si', 1, {}, undefined);

    expect(mocks.jelpyAiService.interpretar).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'sushi con promociones en Tepic' }),
    );
    expect(mocks.conversationService.guardarPreguntaPendiente).toHaveBeenCalledWith('sesion-test', null);
    const textoCompleto = JSON.stringify(resultado.respuesta);
    expect(textoCompleto).not.toMatch(/dime qué necesitas|no entendí/i);
  });

  it('responder "No" a una pregunta de confirmación pendiente confirma y sigue la charla, sin ir a búsqueda (regresión)', async () => {
    const contextResolver = {
      execute: jest.fn().mockReturnValue({
        esSeguimiento: true,
        textoEnriquecido: 'No',
        contextoDisponible: true,
        tipoSeguimiento: 'confirmacion_pendiente',
        respuestaDirecta: {
          titulo: '¡Entendido! 👍',
          mensaje: '¿En qué más te ayudo? Puedo buscar otro negocio, servicio o categoría cuando quieras.',
        },
      }),
      generarRespuestaDetalle: jest.fn(),
    } as any;

    const { service, mocks } = crearServicio({ contextResolver });

    const resultado = await service.processUserMessage('No', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).toMatch(/entendido/i);
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
    expect(mocks.conversationService.guardarPreguntaPendiente).toHaveBeenCalledWith('sesion-test', null);
  });

  it('usuario frustrado recibe respuesta empática y SIN chips', async () => {
    const { service } = crearServicio();

    const resultado = await service.processUserMessage(
      'ya me canse, esto no sirve',
      1,
      {},
      undefined,
    );

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.sugerencias).toEqual([]);
  });

  it('rate limit devuelve status "rate_limited" con mensaje amigable, no un error', async () => {
    const rateLimiter = { verificar: jest.fn().mockReturnValue(false), tiempoRestante: jest.fn().mockReturnValue(12) } as any;
    const { service } = crearServicio({ rateLimiter });

    const resultado = await service.processUserMessage('Hola', 1, {}, undefined);

    expect(resultado.status).toBe('rate_limited');
    expect(resultado.respuesta.mensaje).toContain('12');
  });

  it('blindaje: una excepción real en cualquier dependencia NUNCA se propaga — responde degradado', async () => {
    const conversationService = {
      limpiarSesionesViejas: jest.fn().mockResolvedValue(undefined),
      obtenerOCrearSesion: jest.fn().mockRejectedValue(new Error('DB caída de prueba')),
      guardarTurnoUsuario: jest.fn(),
      guardarTurnoAsistente: jest.fn(),
      obtenerHistorial: jest.fn(),
      actualizarContextoBusqueda: jest.fn(),
      obtenerContextoSesion: jest.fn(),
      cerrarSesion: jest.fn(),
    } as any;

    const { service } = crearServicio({ conversationService });

    await expect(
      service.processUserMessage('Hola', 1, {}, undefined),
    ).resolves.toMatchObject({
      status: 'error_interno',
    });
  });

  it('blindaje: la respuesta degradada siempre trae título, mensaje y sugerencias', async () => {
    const conversationService = {
      limpiarSesionesViejas: jest.fn().mockResolvedValue(undefined),
      obtenerOCrearSesion: jest.fn().mockRejectedValue(new Error('boom')),
    } as any;

    const { service } = crearServicio({ conversationService });

    const resultado = await service.processUserMessage('Promociones', 1, {}, undefined);

    expect(resultado.respuesta.titulo).toBeTruthy();
    expect(resultado.respuesta.mensaje).toBeTruthy();
    expect(Array.isArray(resultado.respuesta.sugerencias)).toBe(true);
  });
});
