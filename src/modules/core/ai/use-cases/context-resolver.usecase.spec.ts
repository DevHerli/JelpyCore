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
