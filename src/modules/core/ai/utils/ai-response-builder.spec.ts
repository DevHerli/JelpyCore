import { AIResponseBuilder } from './ai-response-builder';

describe('AIResponseBuilder', () => {
  it('en búsquedas de catálogo devuelve item y nombre del negocio explícitos', () => {
    const response = AIResponseBuilder.buildFriendlyResponse(
      { intent: 'buscar_items_negocio' },
      [
        {
          negocio_id: 10,
          sucursal_id: 20,
          nombre_negocio: 'Wing House',
          sucursal: 'Sucursal Centro',
          ciudad: 'Tepic',
          item: {
            id: 501,
            nombre: 'Alitas BBQ',
            descripcion: 'Alitas bañadas en salsa BBQ',
            precioBase: 129,
            tipo: 'producto',
            imagenUrl: null,
          },
        },
      ],
    ) as any;

    expect(response.items[0]).toMatchObject({
      nombre: 'Wing House',
      nombreNegocio: 'Wing House',
      itemEncontrado: 'Alitas BBQ',
      item: {
        id: 501,
        nombre: 'Alitas BBQ',
      },
    });
  });
});
