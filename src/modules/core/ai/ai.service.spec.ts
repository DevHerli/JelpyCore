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
  const promocionesSucursalesService = {
    listarPromocionesActivas: jest.fn().mockResolvedValue([]),
    listarPromocionesVigentes: jest.fn().mockResolvedValue([]),
    buscarPromocionesActivasPorTexto: jest.fn().mockResolvedValue([]),
  } as any;
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
    promocionesSucursalesService,
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
    mocks.promocionesSucursalesService,
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
    expect(resultado.respuesta.mensaje).toMatch(/ayudarte|cuéntame|qué necesitas|dime qué buscas/i);
    // JLP-DOBLE-PREGUNTA-FIX: el saludo ya invita a responder por sí solo
    // ("¿Cómo estás? Cuéntame qué necesitas..."); no debe traer pegado un
    // segundo cierre genérico con otra pregunta ("¿Hay algo más en lo que
    // pueda ayudarte?") — una sola pregunta por mensaje.
    expect((resultado.respuesta.mensaje.match(/\?/g) || []).length).toBeLessThanOrEqual(1);
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

  it('"promos activas" pregunta qué tipo de promoción quiere, sin enseñar favoritos o tarjetas al azar', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage('promos activas', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.titulo).toBe('Promociones');
    expect(resultado.respuesta.items).toHaveLength(0);
    expect(resultado.respuesta.mensaje).toMatch(/qué tipo de promociones/i);
    expect(resultado.respuesta.mensaje).toMatch(/sushi|alitas|farmacias|tiendas/i);
    expect(mocks.promocionesSucursalesService.listarPromocionesActivas).not.toHaveBeenCalled();
    expect(mocks.promocionesSucursalesService.listarPromocionesVigentes).not.toHaveBeenCalled();
    expect(mocks.promocionesSucursalesService.buscarPromocionesActivasPorTexto).not.toHaveBeenCalled();
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
    expect(mocks.jelpyAssistant.interpretar).not.toHaveBeenCalled();
    expect(mocks.conversationService.guardarPreguntaPendiente).toHaveBeenCalledWith(
      'sesion-test',
      expect.objectContaining({ tipo: 'promociones_categoria' }),
    );
    expect(mocks.searchTrendLogger.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        queryOriginal: 'promos activas',
        categoriaNombre: 'promociones',
        intent: 'buscar_promociones',
        totalResultados: 0,
        sinResultados: false,
      }),
    );
  });

  it('"promos" NO hereda la búsqueda anterior de cerveza; siempre pregunta qué tipo de promo busca', async () => {
    const contextResolver = {
      execute: jest.fn().mockReturnValue({
        esSeguimiento: true,
        textoEnriquecido: 'cerveza tepic promos',
        contextoDisponible: true,
        tipoSeguimiento: 'refinamiento',
      }),
      generarRespuestaDetalle: jest.fn(),
    } as any;
    const { service, mocks } = crearServicio({ contextResolver });

    const resultado = await service.processUserMessage('promos', 1, { ciudad: 'Tepic' }, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.mensaje).toMatch(/qué tipo de promociones/i);
    expect(resultado.respuesta.items).toHaveLength(0);
    expect(contextResolver.execute).not.toHaveBeenCalled();
    expect(mocks.promocionesSucursalesService.buscarPromocionesActivasPorTexto).not.toHaveBeenCalled();
  });

  it('"promos de la ciudad" muestra promociones vigentes generales y luego pregunta cómo filtrarlas', async () => {
    const promociones = [
      {
        id: 91,
        titulo: 'Promo Martes',
        descripcion: '5 litros de cerveza por $1 peso',
        tipoPromocion: 'Otro',
        valorDescuento: null,
        fechaInicio: '2026-09-16',
        fechaFin: '2026-12-29',
        diasVigencia: 'Martes',
        horaInicio: '19:00:00',
        horaFin: '22:00:00',
        imagenUrl: null,
        sucursal: {
          id: 22,
          nombreSucursal: 'Sucursal Plaza Manglar',
          ciudad: { nombre: 'Tepic' },
          negocio: { nombreNegocio: 'Lucky Juan' },
        },
      },
    ];
    const { service, mocks } = crearServicio({
      promocionesSucursalesService: {
        listarPromocionesActivas: jest.fn().mockResolvedValue([]),
        listarPromocionesVigentes: jest.fn().mockResolvedValue(promociones),
        buscarPromocionesActivasPorTexto: jest.fn().mockResolvedValue([]),
      } as any,
    });

    const resultado = await service.processUserMessage(
      'dame promos de la ciudad',
      1,
      { ciudad: 'Tepic', ciudadId: 7 },
      undefined,
    );

    expect(resultado.status).toBe('aceptado');
    expect(resultado.respuesta.items).toHaveLength(1);
    expect(resultado.respuesta.items[0]).toEqual(
      expect.objectContaining({
        titulo: 'Promo Martes',
        negocio: 'Lucky Juan',
        diasVigencia: 'Martes',
      }),
    );
    expect(resultado.respuesta.seguimiento).toMatch(/comida|bares|servicio|producto/i);
    expect(mocks.promocionesSucursalesService.listarPromocionesVigentes).toHaveBeenCalledWith(7);
    expect(mocks.promocionesSucursalesService.buscarPromocionesActivasPorTexto).not.toHaveBeenCalled();
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
        queryNormalizada: expect.stringMatching(/promociones de sushi/i),
        categoriaNombre: 'sushi',
        intent: 'buscar_promociones',
        totalResultados: 0,
        sinResultados: true,
      }),
    );
  });

  it('"promos de alitas" sin resultados ofrece buscar lugares donde venden alitas y deja ese hilo pendiente', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: null, subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: true, cerca_de_mi: false },
      normalized_text: 'promos de alitas',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    const resultado = await service.processUserMessage('promos de alitas', 1, { ciudad: 'Tepic' }, undefined);

    expect(resultado.respuesta.mensaje).toMatch(/no encontré promociones activas para alitas/i);
    expect(resultado.respuesta.mensaje).toMatch(/lugares donde venden alitas/i);
    expect(resultado.respuesta.seguimiento).toMatch(/te muestro lugares donde venden alitas/i);
    expect(mocks.conversationService.guardarPreguntaPendiente).toHaveBeenCalledWith(
      'sesion-test',
      expect.objectContaining({
        tipo: 'catalogo_item_accion',
        categoria: 'alitas',
        ciudad: 'Tepic',
        accion: 'lugares',
      }),
    );
  });

  it('"promociones de sushi" busca promociones filtradas por texto y devuelve tarjetas de promoción', async () => {
    const promociones = [
      {
        id: 10,
        titulo: '2x1 en sushi',
        descripcion: 'Martes de rollos',
        tipoPromocion: '2x1',
        valorDescuento: null,
        fechaInicio: '2026-09-01',
        fechaFin: '2026-09-30',
        imagenUrl: null,
        sucursal: {
          id: 55,
          nombreSucursal: 'Sucursal Centro',
          ciudad: { nombre: 'Tepic' },
          negocio: { nombreNegocio: 'Sushi Palace' },
        },
      },
    ];
    const { service, mocks } = crearServicio({
      promocionesSucursalesService: {
        listarPromocionesActivas: jest.fn().mockResolvedValue([]),
        buscarPromocionesActivasPorTexto: jest.fn().mockResolvedValue(promociones),
      } as any,
    });

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'sushi', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: true, cerca_de_mi: false },
      normalized_text: 'promociones de sushi',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    const resultado = await service.processUserMessage('promociones de sushi', 1, {}, undefined);

    expect(resultado.status).toBe('aceptado');
    expect(resultado.respuesta.items).toHaveLength(1);
    expect(resultado.respuesta.items[0]).toEqual(
      expect.objectContaining({
        titulo: '2x1 en sushi',
        negocio: 'Sushi Palace',
        sucursal: 'Sucursal Centro',
      }),
    );
    expect(mocks.promocionesSucursalesService.buscarPromocionesActivasPorTexto).toHaveBeenCalledWith('sushi');
    expect(mocks.jelpyAssistant.interpretar).not.toHaveBeenCalled();
  });

  it('"promos chelitas" encuentra promociones que dicen cerveza en la descripción', async () => {
    const promoCerveza = {
      id: 77,
      titulo: 'Promo de bebidas',
      descripcion: '5 litros de cerveza por 1 peso',
      tipoPromocion: 'Descuento',
      valorDescuento: null,
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-30',
      imagenUrl: null,
      sucursal: {
        id: 88,
        nombreSucursal: 'Sucursal Centro',
        ciudad: { nombre: 'Tepic' },
        negocio: { nombreNegocio: 'La Terraza' },
      },
    };
    const buscarPromocionesActivasPorTexto = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([promoCerveza]);

    const { service, mocks } = crearServicio({
      promocionesSucursalesService: {
        listarPromocionesActivas: jest.fn().mockResolvedValue([]),
        buscarPromocionesActivasPorTexto,
      } as any,
    });

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'licorerías', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: true, cerca_de_mi: false },
      normalized_text: 'promos chelitas',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    const resultado = await service.processUserMessage('promos chelitas', 1, {}, undefined);

    expect(resultado.status).toBe('aceptado');
    expect(resultado.respuesta.items).toHaveLength(1);
    expect(resultado.respuesta.items[0]).toEqual(
      expect.objectContaining({
        titulo: 'Promo de bebidas',
        descripcion: '5 litros de cerveza por 1 peso',
        negocio: 'La Terraza',
      }),
    );
    expect(buscarPromocionesActivasPorTexto).toHaveBeenNthCalledWith(1, 'chelitas');
    expect(buscarPromocionesActivasPorTexto).toHaveBeenNthCalledWith(2, 'cerveza');
    expect(mocks.conversationService.guardarPreguntaPendiente).toHaveBeenLastCalledWith(
      'sesion-test',
      null,
    );
  });

  it('"promos kikis" también se relaciona con cerveza para encontrar promociones', async () => {
    const promoCerveza = {
      id: 78,
      titulo: 'Promo de cerveza',
      descripcion: '5 litros de cerveza por 1 peso',
      tipoPromocion: 'Descuento',
      valorDescuento: null,
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-30',
      imagenUrl: null,
      sucursal: {
        id: 89,
        nombreSucursal: 'Sucursal Centro',
        ciudad: { nombre: 'Tepic' },
        negocio: { nombreNegocio: 'La Terraza' },
      },
    };
    const buscarPromocionesActivasPorTexto = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([promoCerveza]);

    const { service, mocks } = crearServicio({
      promocionesSucursalesService: {
        listarPromocionesActivas: jest.fn().mockResolvedValue([]),
        buscarPromocionesActivasPorTexto,
      } as any,
    });

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'licorerías', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: true, cerca_de_mi: false },
      normalized_text: 'promos kikis',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    const resultado = await service.processUserMessage('promos kikis', 1, {}, undefined);

    expect(resultado.status).toBe('aceptado');
    expect(resultado.respuesta.items[0]).toEqual(
      expect.objectContaining({
        descripcion: '5 litros de cerveza por 1 peso',
      }),
    );
    expect(buscarPromocionesActivasPorTexto).toHaveBeenNthCalledWith(1, 'kikis');
    expect(buscarPromocionesActivasPorTexto).toHaveBeenNthCalledWith(2, 'cerveza');
  });

  it('"alitas" sola pregunta si quiere lugares donde venden alitas o promociones, sin buscar restaurantes genéricos', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage('alitas', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.mensaje).toMatch(/lugares donde venden alitas/i);
    expect(resultado.respuesta.mensaje).toMatch(/promociones de alitas/i);
    expect(resultado.respuesta.sugerencias).toEqual([]);
    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
    expect(mocks.jelpyAssistant.interpretar).not.toHaveBeenCalled();
    expect(mocks.conversationService.guardarPreguntaPendiente).toHaveBeenCalledWith(
      'sesion-test',
      expect.objectContaining({ tipo: 'catalogo_item_accion', categoria: 'alitas' }),
    );
  });

  it('"donde venden alitas" sin resultados responde natural: no hay lugar registrado con ese producto', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: null, subcategoria: null, ciudad: 'Tepic', especialidad: null },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: 'donde venden alitas en Tepic',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [],
      filtros_detectados: {},
    });

    const resultado = await service.processUserMessage('donde venden alitas', 1, { ciudad: 'Tepic' }, undefined);

    expect(resultado.respuesta.mensaje).toMatch(/no tengo registrado un lugar donde vendan alitas/i);
    expect(resultado.respuesta.mensaje).not.toMatch(/alitas tepic/i);
    expect(resultado.respuesta.quisisteDecir).toBeUndefined();
  });

  it('"dónde venden tamales/pozole" no usa "venden" para sugerir correcciones absurdas', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockImplementation(async ({ text }: { text: string }) => ({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: null, subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: text,
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    }));

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [],
      filtros_detectados: {},
    });

    for (const mensaje of ['donde venden tamales', 'donde venden pozole']) {
      const resultado = await service.processUserMessage(mensaje, 1, {}, undefined);
      const textoCompleto = JSON.stringify(resultado.respuesta);

      expect(textoCompleto).not.toMatch(/venden/i);
      expect(textoCompleto).not.toMatch(/lentes/i);
      expect(resultado.respuesta.quisisteDecir).toBeUndefined();
    }
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

  it('entiende "dime lugar de pistear" como bares/antros, no como búsqueda literal de lugar', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'bares', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: 'bares antros cantinas cerveza',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [],
      filtros_detectados: {},
    });

    const resultado = await service.processUserMessage('dime lugar de pistear', 1, {}, undefined);

    expect(mocks.jelpyAiService.interpretar).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/bares.*antros.*cantinas/i) }),
    );
    expect(JSON.stringify(resultado.respuesta)).not.toMatch(/no encontré "lugar"|lentes/i);
  });

  it('entiende "donde están las chelitas más baras" como chelas/caguamas baratas, no como "están"', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'licorerías', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: true, cerca_de_mi: false },
      normalized_text: 'caguamerias licorerias cerveza barata',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      resultados: [],
      filtros_detectados: {},
    });

    const resultado = await service.processUserMessage(
      'dime donde estan las chelitas mas baras',
      1,
      {},
      undefined,
    );

    expect(mocks.jelpyAiService.interpretar).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/caguamerias.*licorerias.*cerveza barata/i) }),
    );
    expect(JSON.stringify(resultado.respuesta)).not.toMatch(/no encontré "estan"|lentes/i);
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

  // JLP-TIENDAS-UMBRELLA-FIX: el usuario reportó que "tiendas cerca" (y
  // "quiero tiendas cerca") respondían "No encontré 'tiendas' 🤔
  // ¿Quisiste decir 'bandas'?" — una corrección ortográfica sin sentido,
  // porque "tiendas" nunca podía mapearse a un alias exacto de negocio
  // (es una palabra sombrilla como "comida"/"salud"/"belleza"/
  // "servicios"). Verifica extremo a extremo que ahora, en vez de buscar
  // a ciegas y fallar, Jelpy pregunta qué tipo de tienda sin llamar al
  // microservicio de IA ni a la corrección ortográfica.
  it('"tiendas cerca" pregunta qué tipo de tienda, sin buscar a ciegas ni sugerir "bandas" (regresión)', async () => {
    const { service, mocks } = crearServicio();

    for (const texto of ['tiendas cerca', 'quiero tiendas cerca']) {
      const resultado = await service.processUserMessage(texto, 1, {}, undefined);

      expect(resultado.status).toBe('chat');
      expect(resultado.respuesta.mensaje).toMatch(/abarrotes/i);
      expect(resultado.respuesta.mensaje).not.toMatch(/quisiste decir/i);
    }

    expect(mocks.jelpyAiService.interpretar).not.toHaveBeenCalled();
  });

  // JLP-CORTE-PELO-AMBIGUO-FIX: el usuario reportó que pidió "corte de
  // pelo" y Jelpy "no entendió", cuando en realidad "corte de pelo" se
  // puede hacer en una barbería/salón de belleza (para personas) O en una
  // estética canina (para mascotas) — Jelpy debe decir explícitamente que
  // existen ambas opciones y preguntar para quién es, en vez de intentar
  // adivinar una sola o fallar en silencio.
  it('"corte de pelo" pregunta si es para el usuario o su mascota, sin disparar una búsqueda a ciegas (regresión)', async () => {
    const { service, mocks } = crearServicio();

    const resultado = await service.processUserMessage('corte de pelo', 1, {}, undefined);

    expect(resultado.status).toBe('chat');
    expect(resultado.respuesta.mensaje).toMatch(/barber/i);
    expect(resultado.respuesta.mensaje).toMatch(/mascota|perro|gato/i);
    expect(mocks.jelpyAssistant.interpretar).not.toHaveBeenCalled();
  });

  it('"corte de pelo para mi perro" ya trae la pista de para quién es y NO pregunta, sigue directo a búsqueda', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'buscar_negocios',
      confidence: 0.9,
      entities: { categoria: 'estéticas caninas', subcategoria: null, ciudad: null, especialidad: null },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: 'corte de pelo para mi perro',
      reply: { mode: 'search', title: null, message: null, suggestions: [] },
    });

    mocks.jelpyAssistant.interpretar.mockResolvedValue({
      filtros_detectados: {},
      resultados: { items: [] },
      sin_resultados: true,
      suggestedQueries: [],
    });

    const resultado = await service.processUserMessage(
      'corte de pelo para mi perro',
      1,
      {},
      undefined,
    );

    expect(resultado.respuesta.mensaje).not.toMatch(/para quién es/i);
    expect(mocks.jelpyAssistant.interpretar).toHaveBeenCalled();
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
