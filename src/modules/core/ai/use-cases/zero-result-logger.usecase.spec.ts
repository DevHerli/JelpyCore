import { ZeroResultLoggerUseCase } from './zero-result-logger.usecase';

/**
 * JLP-TREND-SUSCRIPTOR-FIX: el usuario pidió poder saber, por suscriptor,
 * qué negocio/promoción busca y no encuentra (para "Jelpy Trend"). Antes,
 * `ZeroResultQuery` no guardaba `usuarioId`/`sessionId` — el dato era
 * 100% anónimo/agregado. Esta suite fija que el logger ahora persiste esa
 * atribución cuando se le proporciona, y sigue funcionando (sin romper)
 * cuando no se proporciona (usuario anónimo).
 */
describe('ZeroResultLoggerUseCase', () => {
  function crearUseCase() {
    const repo: any = {
      create: jest.fn((x) => x),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new ZeroResultLoggerUseCase(repo);
    return { useCase, repo };
  }

  it('guarda usuarioId y sessionId cuando se proporcionan', async () => {
    const { useCase, repo } = crearUseCase();

    await useCase.execute('sushi en tepic', 'Tepic', {
      categoriaId: 3,
      subcategoriaId: null,
      intent: 'buscar',
      usuarioId: 42,
      sessionId: 'sesion-abc',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 42, sessionId: 'sesion-abc' }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('guarda usuarioId/sessionId como null cuando no se proporcionan (usuario anónimo)', async () => {
    const { useCase, repo } = crearUseCase();

    await useCase.execute('sushi en tepic', 'Tepic');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: null, sessionId: null }),
    );
  });

  it('no rompe el flujo si falla el guardado en BD', async () => {
    const repo: any = {
      create: jest.fn((x) => x),
      save: jest.fn().mockRejectedValue(new Error('DB caída')),
    };
    const useCase = new ZeroResultLoggerUseCase(repo);

    await expect(
      useCase.execute('sushi', 'Tepic', { usuarioId: 1, sessionId: 's1' }),
    ).resolves.toBeUndefined();
  });
});
