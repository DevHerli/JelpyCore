import { PromocionesSucursalesService } from './promociones-sucursales.service';

describe('PromocionesSucursalesService', () => {
  function crearQueryBuilder() {
    const qb: any = {
      distinct: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    return qb;
  }

  it('buscarPromocionesActivasPorTexto busca promociones vigentes por fecha sin excluir por día de vigencia', async () => {
    const qb = crearQueryBuilder();
    const promoRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const service = new PromocionesSucursalesService(
      promoRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.buscarPromocionesActivasPorTexto('cerveza');

    const condiciones = qb.andWhere.mock.calls.map(([condicion]: [string]) => condicion).join(' ');

    expect(condiciones).toContain('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin');
    expect(condiciones).not.toContain('dias_vigencia');
    expect(condiciones).toContain('LOWER(COALESCE(promo.descripcion');
  });
});
