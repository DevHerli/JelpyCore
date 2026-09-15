import { ConversationService } from './conversation.service';

/**
 * JLP-RETENCION-HISTORIAL-FIX: el usuario reportó que el chat promete
 * conservar los mensajes 24 horas, pero al reabrirlo "los mensajes no se
 * guardan ni una hora". La causa real: el endpoint público de historial
 * reutilizaba `obtenerHistorial()`, pensado para un límite interno de 6
 * turnos (contexto de IA), truncando el historial visible a solo los
 * últimos 3 intercambios sin importar qué tan reciente fuera el resto.
 *
 * Esta suite fija, con pruebas, que:
 * - `obtenerHistorial()` (uso interno de IA) conserva su límite de 6 turnos.
 * - `obtenerHistorialCompleto()` (uso del endpoint público) NO tiene ese
 *   límite de 6 y devuelve todos los turnos dentro de la ventana real de
 *   retención (24 horas).
 */
describe('ConversationService', () => {
  function crearServicio(turnosEnBD: any[]) {
    const turnRepo: any = {
      find: jest.fn().mockImplementation(({ take }: any) => {
        // Simula que el "find" real de TypeORM ya filtró por sessionId y
        // por la ventana de fecha (creadoEn >= limite) en la capa de BD;
        // aquí solo emulamos el recorte `take`, si viene.
        return Promise.resolve(
          typeof take === 'number' ? turnosEnBD.slice(0, take) : turnosEnBD,
        );
      }),
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const sessionRepo: any = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
      delete: jest.fn(),
    };
    const service = new ConversationService(sessionRepo, turnRepo);
    return { service, turnRepo, sessionRepo };
  }

  it('obtenerHistorial() (uso interno de IA) sigue limitado a los últimos 6 turnos', async () => {
    const turnos = Array.from({ length: 20 }, (_, i) => ({ id: i }));
    const { service, turnRepo } = crearServicio(turnos);

    const resultado = await service.obtenerHistorial('sesion-1');

    expect(resultado).toHaveLength(6);
    expect(turnRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 }),
    );
  });

  it('obtenerHistorialCompleto() (endpoint público) NO trunca a 6 turnos, aunque haya muchos intercambios recientes', async () => {
    // Escenario real observado: una sesión con 16 turnos en pocos minutos.
    const turnos = Array.from({ length: 16 }, (_, i) => ({ id: i }));
    const { service, turnRepo } = crearServicio(turnos);

    const resultado = await service.obtenerHistorialCompleto('sesion-1');

    expect(resultado).toHaveLength(16);
    expect(turnRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: 'sesion-1' }),
      }),
    );
  });

  it('obtenerHistorialCompleto() consulta con un filtro de fecha (ventana de retención), no solo por sessionId', async () => {
    const { service, turnRepo } = crearServicio([]);

    await service.obtenerHistorialCompleto('sesion-1');

    const argumentosLlamada = turnRepo.find.mock.calls[0][0];
    expect(argumentosLlamada.where.creadoEn).toBeDefined();
  });

  it('obtenerHistorialCompleto() no rompe si la BD falla — devuelve []', async () => {
    const turnRepo: any = {
      find: jest.fn().mockRejectedValue(new Error('DB caída')),
    };
    const sessionRepo: any = {};
    const service = new ConversationService(sessionRepo, turnRepo);

    const resultado = await service.obtenerHistorialCompleto('sesion-1');

    expect(resultado).toEqual([]);
  });
});
