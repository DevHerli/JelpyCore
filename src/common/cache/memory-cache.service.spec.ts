import { MemoryCacheService } from './memory-cache.service';

describe('MemoryCacheService', () => {
  let cache: MemoryCacheService;

  beforeEach(() => {
    cache = new MemoryCacheService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('almacena y recupera un valor', () => {
    cache.set('k', 123);
    expect(cache.get<number>('k')).toBe(123);
  });

  it('devuelve undefined para una clave inexistente', () => {
    expect(cache.get('nope')).toBeUndefined();
  });

  it('no cachea valores undefined', () => {
    cache.set('k', undefined);
    expect(cache.size()).toBe(0);
    expect(cache.get('k')).toBeUndefined();
  });

  it('expira las entradas al superar el TTL', () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    cache.set('k', 'v', 1000);

    // Antes de vencer.
    jest.spyOn(Date, 'now').mockReturnValue(now + 999);
    expect(cache.get('k')).toBe('v');

    // Después de vencer: expira perezosamente y se elimina.
    jest.spyOn(Date, 'now').mockReturnValue(now + 1001);
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it('wrap: ejecuta el loader una sola vez y luego sirve de caché', async () => {
    const loader = jest.fn().mockResolvedValue('cargado');

    const a = await cache.wrap('k', loader);
    const b = await cache.wrap('k', loader);

    expect(a).toBe('cargado');
    expect(b).toBe('cargado');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('wrap: vuelve a ejecutar el loader tras expirar el TTL', async () => {
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const loader = jest.fn().mockResolvedValue('v');

    await cache.wrap('k', loader, 1000);
    jest.spyOn(Date, 'now').mockReturnValue(now + 2000);
    await cache.wrap('k', loader, 1000);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('del: elimina una clave puntual', () => {
    cache.set('k', 1);
    cache.del('k');
    expect(cache.get('k')).toBeUndefined();
  });

  it('delByPrefix: invalida toda la familia de claves', () => {
    cache.set('cat:findAll', 1);
    cache.set('cat:activas', 2);
    cache.set('otro:x', 3);

    cache.delByPrefix('cat:');

    expect(cache.get('cat:findAll')).toBeUndefined();
    expect(cache.get('cat:activas')).toBeUndefined();
    expect(cache.get('otro:x')).toBe(3);
  });

  it('clear: vacía todo el almacén', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('expulsa la entrada más antigua al superar maxEntries (cota de memoria)', () => {
    // maxEntries = 500 (privado). Insertamos 501 y verificamos la cota.
    for (let i = 0; i < 501; i++) {
      cache.set(`k${i}`, i);
    }
    expect(cache.size()).toBe(500);
    // La primera insertada (k0) debe haber sido expulsada.
    expect(cache.get('k0')).toBeUndefined();
    expect(cache.get('k500')).toBe(500);
  });

  it('LRU: leer una entrada la marca como reciente y la libra de la expulsión', () => {
    for (let i = 0; i < 500; i++) {
      cache.set(`k${i}`, i);
    }
    // Toca k0 para marcarla como usada recientemente.
    expect(cache.get('k0')).toBe(0);
    // Inserta una nueva: debe expulsar la más antigua NO tocada (k1), no k0.
    cache.set('k500', 500);

    expect(cache.get('k0')).toBe(0);
    expect(cache.get('k1')).toBeUndefined();
  });
});
