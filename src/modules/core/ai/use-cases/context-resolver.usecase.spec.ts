import { ContextResolverUseCase } from './context-resolver.usecase';
import { ConversationSession } from '../../conversation/entities/conversation-session.entity';

/**
 * JLP-UMBRELLA-CONTEXTO-FIX: el usuario reportó que, tras buscar
 * "promociones sushi" en el chat, escribir solo "comida" (esperando ver
 * negocios de la categoría comida) le devolvía la promoción de sushi de la
 * búsqueda anterior — totalmente ajena a lo que pidió. Se confirmó con
 * datos reales de producción (sesión c8f9ecf0-...) que el resolver de
 * contexto concatenaba "promociones sushi" + "comida" porque "comida" es
 * una palabra SOMBRILLA (ver `ChatResponses.detectarCategoriaUmbrella`) que
 * `ConversationClassifier.contieneTerminoDeNegocio` no reconoce como
 * término de negocio, cayendo en la regla de "respaldo genérico" (caso 5)
 * pensada para chips de seguimiento reales.
 *
 * Esta suite fija que las palabras sombrilla (comida/salud/belleza/
 * servicios) SIEMPRE se tratan como una navegación de categoría nueva e
 * independiente, sin heredar el contexto de una búsqueda anterior no
 * relacionada — mientras que los chips de seguimiento reales (que sí traen
 * un término de negocio propio o coinciden con las listas conocidas) siguen
 * funcionando igual que antes.
 */
describe('ContextResolverUseCase', () => {
  const useCase = new ContextResolverUseCase();

  function sesionConBusquedaPrevia(ultimaQuery: string): ConversationSession {
    return {
      id: 'sesion-1',
      ultimoIntent: 'buscar_promociones',
      ultimaQuery,
      ultimoResultado: [],
      ultimosFiltros: null,
      ciudad: 'Tepic',
    } as any;
  }

  it('"comida" tras una búsqueda previa NO ANTEPONE la query vieja (caso real: "promociones sushi" + "comida")', () => {
    const sesion = sesionConBusquedaPrevia('promociones sushi');

    const resultado = useCase.execute('comida', sesion);

    expect(resultado.textoEnriquecido).toBe('comida');
    expect(resultado.esSeguimiento).toBe(false);
  });

  it.each(['salud', 'belleza', 'servicios', 'servicio'])(
    'palabra sombrilla "%s" tampoco hereda el contexto de una búsqueda previa no relacionada',
    (palabra) => {
      const sesion = sesionConBusquedaPrevia('farmacias abiertas');

      const resultado = useCase.execute(palabra, sesion);

      expect(resultado.textoEnriquecido).toBe(palabra);
      expect(resultado.esSeguimiento).toBe(false);
    },
  );

  it('un chip de seguimiento real (sin término de negocio propio, sin ser palabra sombrilla) SIGUE heredando la query anterior', () => {
    const sesion = sesionConBusquedaPrevia('farmacia en Tepic');

    // "más económico" no es palabra sombrilla ni trae su propio término de
    // negocio: debe seguir comportándose como continuación de la búsqueda.
    const resultado = useCase.execute('más económico', sesion);

    expect(resultado.esSeguimiento).toBe(true);
    expect(resultado.textoEnriquecido).toBe('farmacia en Tepic más económico');
  });

  it('una búsqueda con término de negocio propio ("tacos") sigue sin heredar contexto viejo (comportamiento previo intacto)', () => {
    const sesion = sesionConBusquedaPrevia('promociones sushi');

    const resultado = useCase.execute('tacos', sesion);

    expect(resultado.textoEnriquecido).toBe('tacos');
    expect(resultado.esSeguimiento).toBe(false);
  });
});

/**
 * JLP-CORTE-PELO-HILO-FIX: bug reportado por el usuario (con captura de
 * pantalla) — Jelpy pregunta "¿Corte de pelo para ti o para tu mascota?" y,
 * al responder algo tan simple como "Para mi", el hilo se rompe por
 * completo ("No entendí bien, pero puedo ayudarte a buscar..."). Causa
 * raíz: esa pregunta se genera 100% local, ANTES de cualquier búsqueda real
 * (`AiService`, rama `esCortePeloAmbiguo`), así que `sesion.ultimoIntent`
 * nunca se establece — y `ContextResolverUseCase.execute()` cortaba camino
 * en el guard inicial (`if (!sesion || !sesion.ultimoIntent) return
 * sinContexto`) antes de siquiera mirar si había una pregunta pendiente
 * guardada. Esta suite fija que, con `pendienteConfirmacion.tipo ===
 * 'corte_pelo_para_quien'` guardado en la sesión, una respuesta corta SÍ
 * seconoce sin importar `ultimoIntent`, y se resuelve hacia la búsqueda
 * correcta (barbería/salón de belleza para persona, estética canina para
 * mascota) en vez de perderse.
 */
describe('ContextResolverUseCase — hilo de "¿corte de pelo para ti o tu mascota?" (JLP-CORTE-PELO-HILO-FIX)', () => {
  const useCase = new ContextResolverUseCase();

  function sesionConPreguntaCortePeloPendiente(ciudad = 'Tepic'): ConversationSession {
    return {
      id: 'sesion-corte-pelo',
      // JLP-CORTE-PELO-HILO-FIX: a propósito SIN `ultimoIntent` — así se
      // ve exactamente en producción, porque la pregunta ambigua se
      // responde antes de cualquier búsqueda real.
      ultimoIntent: undefined,
      ultimaQuery: undefined,
      ultimoResultado: undefined,
      ultimosFiltros: {
        pendienteConfirmacion: { tipo: 'corte_pelo_para_quien', ciudad },
      },
      ciudad,
    } as any;
  }

  it.each(['Para mi', 'para mí', 'yo', 'soy yo', 'para mi hijo', 'mi mamá', 'mi jefe'])(
    '"%s" resuelve hacia barbería/salón de belleza (humano) sin caer en "no entendí"',
    (respuesta) => {
      const sesion = sesionConPreguntaCortePeloPendiente();

      const resultado = useCase.execute(respuesta, sesion);

      expect(resultado.esSeguimiento).toBe(true);
      expect(resultado.textoEnriquecido).toContain('barbería');
      expect(resultado.textoEnriquecido).toContain('Tepic');
    },
  );

  it.each(['para mi perrito', 'para mi gatita', 'mi mascota', 'para mi perrihijo'])(
    '"%s" resuelve hacia estética canina (mascota) sin caer en "no entendí"',
    (respuesta) => {
      const sesion = sesionConPreguntaCortePeloPendiente();

      const resultado = useCase.execute(respuesta, sesion);

      expect(resultado.esSeguimiento).toBe(true);
      expect(resultado.textoEnriquecido).toContain('estética canina');
    },
  );

  it('una respuesta que no aclara nada NO se marca como seguimiento resuelto (deja pasar de largo)', () => {
    const sesion = sesionConPreguntaCortePeloPendiente();

    const resultado = useCase.execute('no se', sesion);

    expect(resultado.esSeguimiento).toBe(false);
  });

  it('sin ninguna pregunta pendiente ni ultimoIntent, sigue devolviendo sinContexto (sin regresión)', () => {
    const sesion = {
      id: 'sesion-normal',
      ultimoIntent: undefined,
      ultimaQuery: undefined,
      ultimoResultado: undefined,
      ultimosFiltros: null,
      ciudad: 'Tepic',
    } as any;

    const resultado = useCase.execute('Para mi', sesion);

    expect(resultado.esSeguimiento).toBe(false);
    expect(resultado.textoEnriquecido).toBe('Para mi');
  });
});

describe('ContextResolverUseCase — preguntas pendientes de promociones y catálogo', () => {
  const useCase = new ContextResolverUseCase();

  function sesionConPendiente(pendienteConfirmacion: any, ciudad = 'Tepic'): ConversationSession {
    return {
      id: 'sesion-pendiente',
      ultimoIntent: undefined,
      ultimaQuery: undefined,
      ultimoResultado: undefined,
      ultimosFiltros: { pendienteConfirmacion },
      ciudad,
    } as any;
  }

  it('si Jelpy pregunta qué promociones quiere y el usuario dice "sushi", lo convierte en promociones de sushi', () => {
    const sesion = sesionConPendiente({ tipo: 'promociones_categoria', ciudad: 'Tepic' });

    const resultado = useCase.execute('sushi', sesion);

    expect(resultado.esSeguimiento).toBe(true);
    expect(resultado.tipoSeguimiento).toBe('confirmacion_pendiente');
    expect(resultado.textoEnriquecido).toBe('promociones de sushi en Tepic');
  });

  it('si el usuario responde "promos" a la pregunta de alitas, busca promociones de alitas', () => {
    const sesion = sesionConPendiente({
      tipo: 'catalogo_item_accion',
      categoria: 'alitas',
      ciudad: 'Tepic',
    });

    const resultado = useCase.execute('promos', sesion);

    expect(resultado.esSeguimiento).toBe(true);
    expect(resultado.textoEnriquecido).toBe('promociones de alitas en Tepic');
  });

  it('si el usuario responde "donde venden" a la pregunta de alitas, busca negocios con ese producto', () => {
    const sesion = sesionConPendiente({
      tipo: 'catalogo_item_accion',
      categoria: 'alitas',
      ciudad: 'Tepic',
    });

    const resultado = useCase.execute('donde venden', sesion);

    expect(resultado.esSeguimiento).toBe(true);
    expect(resultado.textoEnriquecido).toBe('donde venden alitas en Tepic');
  });

  it('si el usuario dice "no" ante una pregunta pendiente, responde directo sin buscar', () => {
    const sesion = sesionConPendiente({ tipo: 'promociones_categoria', ciudad: 'Tepic' });

    const resultado = useCase.execute('no', sesion);

    expect(resultado.esSeguimiento).toBe(true);
    expect(resultado.respuestaDirecta?.mensaje).toMatch(/cuando quieras/i);
  });
});
