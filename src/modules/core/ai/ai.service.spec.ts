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
  } as any;

  const zeroResultLogger = { execute: jest.fn().mockResolvedValue(undefined) } as any;
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
    mocks.jelpyAssistant,
    mocks.jelpyAiService,
    mocks.publicidadChatService,
    mocks.usuarioPreferenciasService,
    mocks.likesService,
  );

  return { service, mocks };
}

describe('AiService.processUserMessage — pruebas de conversación', () => {
  it('"Hola" responde por el fast-path local, sin llamar a FastAPI, con chips', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage('Hola', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).toBeTruthy();
    expect(resultado.respuesta.mensaje).toBeTruthy();
    expect(resultado.respuesta.sugerencias.length).toBeGreaterThan(0);
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
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
  });

  it('mensaje realmente ambiguo ("algo bonito") hace una pregunta guiada con chips de categoría (Capa 2)', async () => {
    const { service } = crearServicio();

    const resultado = await service.processUserMessage('algo bonito', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).toMatch(/entenderte mejor|qué tipo de lugar/i);
    // 4 chips, uno por categoría grande (comida, salud, belleza, explorar)
    expect(resultado.respuesta.sugerencias).toHaveLength(4);
  });

  it('relleno corto ("ok") sigue con el empujón amistoso, no con la pregunta guiada de Capa 2', async () => {
    const { service } = crearServicio();

    const resultado = await service.processUserMessage('ok', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).not.toMatch(/entenderte mejor|qué tipo de lugar/i);
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
