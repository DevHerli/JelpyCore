import { JelpyAssistantService } from './jelpy-assistant.service';

function crearMocks() {
  const ciudadRepo = { find: jest.fn().mockResolvedValue([]) };
  const categoriaRepo = { find: jest.fn().mockResolvedValue([]) };
  const subcatRepo = { find: jest.fn().mockResolvedValue([]) };
  const especialidadRepo = { find: jest.fn().mockResolvedValue([]) };
  const keywordRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const caracteristicaRepo = { find: jest.fn().mockResolvedValue([]) };
  const caracteristicaAliasRepo = { find: jest.fn().mockResolvedValue([]) };

  const searchService = {
    search: jest.fn().mockResolvedValue({ items: [] }),
    searchByItems: jest.fn().mockResolvedValue({ items: [] }),
  };

  const usuarioPreferenciasService = {
    obtenerPreferencias: jest.fn().mockResolvedValue([]),
  };

  const jelpyAiService = {
    interpretar: jest.fn(),
  };

  return {
    ciudadRepo,
    categoriaRepo,
    subcatRepo,
    especialidadRepo,
    keywordRepo,
    caracteristicaRepo,
    caracteristicaAliasRepo,
    searchService,
    usuarioPreferenciasService,
    jelpyAiService,
  };
}

function crearServicio(overrides: Partial<ReturnType<typeof crearMocks>> = {}) {
  const mocks = { ...crearMocks(), ...overrides };

  const service = new JelpyAssistantService(
    mocks.ciudadRepo as any,
    mocks.categoriaRepo as any,
    mocks.subcatRepo as any,
    mocks.especialidadRepo as any,
    mocks.keywordRepo as any,
    mocks.caracteristicaRepo as any,
    mocks.caracteristicaAliasRepo as any,
    mocks.searchService as any,
    mocks.usuarioPreferenciasService as any,
    mocks.jelpyAiService as any,
  );

  return { service, mocks };
}

describe('JelpyAssistantService.interpretar (JLP-FALLBACK-CATEGORIA-CRUZADA-FIX)', () => {
  it('"corte de pelo" sin peluquería/barbería resoluble en BD NO cae al fallback de texto libre sin categoría (bug reportado: mostraba farmacias)', async () => {
    const { service, mocks } = crearServicio();

    // Respuesta real capturada del microservicio FastAPI para "corte de pelo":
    // detecta correctamente la categoría/subcategoría, pero con intent "chat"
    // y baja confianza. La BD (mockeada aquí) no tiene ninguna categoría ni
    // subcategoría que contenga "belleza"/"peluqueria" como substring, así
    // que la resolución a ID falla — este es exactamente el escenario que
    // producía el bug.
    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'chat',
      confidence: 0.55,
      entities: {
        categoria: 'belleza',
        subcategoria: 'peluqueria',
        ciudad: null,
        especialidad: null,
        caracteristica: null,
      },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: 'corte de pelo',
      reply: {
        mode: 'direct_reply',
        title: 'Aquí estoy para ayudarte 💙',
        message: 'Estoy cerca de ti para lo que necesites...',
        suggestions: [],
      },
    });

    // Si el fallback de texto libre (sin categoría) se llegara a ejecutar,
    // devolvería (por accidente) un negocio de un giro totalmente distinto —
    // tal como reportó el usuario ("le pedí corte de pelo y me mandó
    // resultados de farmacias").
    let llamadas = 0;
    mocks.searchService.search.mockImplementation(() => {
      llamadas += 1;
      if (llamadas <= 2) return Promise.resolve({ items: [] });
      return Promise.resolve({
        items: [{ id: 999, nombre: 'Farmacia Equivocada', subcategoria_id: 1 }],
      });
    });

    const resultado = await service.interpretar('corte de pelo');

    // La categoría no se resolvió a un ID real (BD mockeada sin coincidencias)...
    expect(resultado.filtros_detectados.categoriaId).toBeUndefined();
    expect(resultado.filtros_detectados.subcategoriaId).toBeUndefined();

    // ...pero como la IA SÍ detectó un concepto de categoría claro
    // (categoria="belleza"/subcategoria="peluqueria"), NO debe cruzarse a un
    // negocio de otro giro: debe preferir "sin resultados" antes que mostrar
    // una farmacia.
    expect(resultado.resultados.items).toHaveLength(0);
    expect(resultado.sin_resultados).toBe(true);
    expect(resultado.filtros_detectados.fallbackReason).not.toBe('por_nombre_negocio');

    // El fallback de texto libre sin categoría (la 3ª llamada a `search`)
    // nunca debió ejecutarse.
    expect(mocks.searchService.search).toHaveBeenCalledTimes(2);
  });

  it('sigue permitiendo el fallback por nombre cuando la IA NO detectó ninguna categoría (caso legítimo, ej. buscar por nombre propio de negocio)', async () => {
    const { service, mocks } = crearServicio();

    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'chat',
      confidence: 0.4,
      entities: {
        categoria: null,
        subcategoria: null,
        ciudad: null,
        especialidad: null,
        caracteristica: null,
      },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: 'super pollo tepic',
      reply: { mode: 'direct_reply', title: null, message: null, suggestions: [] },
    });

    let llamadas = 0;
    mocks.searchService.search.mockImplementation(() => {
      llamadas += 1;
      if (llamadas <= 2) return Promise.resolve({ items: [] });
      return Promise.resolve({
        items: [{ id: 1, nombre: 'Super Pollo Tepic', subcategoria_id: 5 }],
      });
    });

    const resultado = await service.interpretar('super pollo tepic');

    // Sin categoría detectada por la IA, el fallback por nombre de negocio
    // sigue siendo válido y debe poder encontrar el negocio por su nombre propio.
    expect(resultado.resultados.items).toHaveLength(1);
    expect(resultado.filtros_detectados.fallbackReason).toBe('por_nombre_negocio');
    expect(mocks.searchService.search).toHaveBeenCalledTimes(3);
  });
});

describe('JelpyAssistantService.interpretar — especialidad médica por nombre corto/coloquial (JLP-ESPECIALIDAD-BUSQUEDA-FIX)', () => {
  // Bug reportado por el usuario: pidió "trauma"/"traumatologo"/
  // "traumatologia" y Jelpy respondió "no encontré resultados" pese a
  // existir un doctor con especialidad "Traumatología" dado de alta.
  // FastAPI, en estos casos, no siempre reconoce el término como entidad
  // "especialidad" (más aún con la forma corta/coloquial "trauma"), así
  // que Jelpy debe apoyarse en su diccionario semántico local para
  // resolverlo de todas formas contra la especialidad real de la BD.
  const especialidadTraumatologiaEnBD = {
    id: 5,
    nombre: 'Traumatología',
    subcategoria: { id: 2, categoria: { id: 1 } },
  };

  function mockFastApiSinEntidades(mocks: ReturnType<typeof crearMocks>, textoUsuario: string) {
    mocks.jelpyAiService.interpretar.mockResolvedValue({
      intent: 'chat',
      confidence: 0.3,
      entities: {
        categoria: null,
        subcategoria: null,
        ciudad: null,
        especialidad: null,
        caracteristica: null,
      },
      filters: { abierto_ahora: false, promos: false, cerca_de_mi: false },
      normalized_text: textoUsuario,
      reply: { mode: 'direct_reply', title: null, message: null, suggestions: [] },
    });
  }

  it.each(['trauma', 'traumatologo', 'traumatologia'])(
    '"%s" resuelve la especialidad "Traumatología" de la BD aunque FastAPI no haya detectado ninguna entidad',
    async (textoUsuario) => {
      const { service, mocks } = crearServicio({
        especialidadRepo: {
          find: jest.fn().mockResolvedValue([especialidadTraumatologiaEnBD]),
        } as any,
      });

      mockFastApiSinEntidades(mocks, textoUsuario);

      mocks.searchService.search.mockResolvedValue({
        items: [{ id: 10, nombre: 'Consultorio Dr. González', especialidad_id: 5 }],
      });

      const resultado = await service.interpretar(textoUsuario);

      expect(resultado.filtros_detectados.especialidadId).toBe(5);
      expect(resultado.filtros_detectados.subcategoriaId).toBe(2);
      expect(resultado.resultados.items).toHaveLength(1);
      expect(resultado.sin_resultados).toBe(false);

      // La búsqueda de texto libre (q) debe usar el nombre REAL de la
      // especialidad ("Traumatología"), no el texto crudo del usuario —
      // de lo contrario el filtro de texto (AND) anularía el match del
      // especialidadId cuando el texto crudo no es substring literal del
      // nombre en BD (ej. "traumatologo" no es substring de "Traumatología").
      expect(mocks.searchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ especialidadId: 5, q: 'Traumatología' }),
      );
    },
  );
});
