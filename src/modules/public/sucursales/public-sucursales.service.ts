import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { SucursalNegocio } from '../../business/sucursales_negocios/entities/sucursal-negocio.entity';
import { HorarioSucursal } from '../../business/horario_sucursal/entities/horarios-sucursal.entity';
import { EstadisticaSucursalHistorico } from '../../core/metrics/estadisticas-sucursales-historico/entities/estadistica-sucursal-historico.entity';
import { SucursalLike } from '../../core/sucursal-likes/entities/sucursal-like.entity';

@Injectable()
export class PublicSucursalesService {
  constructor(
    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(HorarioSucursal)
    private readonly horarioRepo: Repository<HorarioSucursal>,

    @InjectRepository(EstadisticaSucursalHistorico)
    private readonly metricaRepo: Repository<EstadisticaSucursalHistorico>,

    @InjectRepository(SucursalLike)
    private readonly likeRepo: Repository<SucursalLike>,

    private readonly cfg: ConfigService,
  ) {}

  // ─── Listado con filtros ────────────────────────────────────────────────────

  async listar(params: {
    categoriaId?: number;
    subcategoriaId?: number;
    ciudadId?: number;
    page: number;
    limit: number;
  }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const qb = this.baseQuery().skip(skip).take(limit);

    if (params.ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId: params.ciudadId });
    }

    if (params.subcategoriaId) {
      qb.andWhere('sub.id = :subcategoriaId', { subcategoriaId: params.subcategoriaId });
    } else if (params.categoriaId) {
      // Filtrar por categoría contemplando dos casos:
      // 1. El negocio tiene categoria_id seteado directamente
      // 2. El negocio solo tiene subcategoria_id, cuya subcategoría pertenece a esa categoría
      qb.andWhere(
        '(cat.id = :categoriaId OR sub_cat.id = :categoriaId)',
        { categoriaId: params.categoriaId },
      );
    }

    const [sucursales, total] = await qb.getManyAndCount();
    const items = await this.mapear(sucursales);

    return { items, total, page, limit };
  }

  // ─── Destacados (con membresía activa) ──────────────────────────────────────

  async destacados(params: { ciudadId?: number; limit: number }) {
    const qb = this.baseQuery().take(params.limit);

    if (params.ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId: params.ciudadId });
    }

    qb.innerJoin(
      'ventas_membresias',
      'vm',
      'vm.negocio_id = n.id AND vm.estatus = :estatus AND (vm.fecha_expiracion IS NULL OR vm.fecha_expiracion > NOW())',
      { estatus: 'pagado' },
    );

    qb.orderBy('n.fechaRegistro', 'DESC');

    const sucursales = await qb.getMany();
    const items = await this.mapear(sucursales);

    return { items, total: items.length, page: 1, limit: params.limit };
  }

  // ─── Más buscados (últimos 30 días, ordenado por SUM(busquedas)) ─────────────

  async masBuscados(params: { ciudadId?: number; limit: number; dias: number }) {
    const { ciudadId, limit, dias } = params;

    // 1. Obtener los top sucursal_id por búsquedas en los últimos N días
    const qbMetrica = this.metricaRepo
      .createQueryBuilder('m')
      .select('m.sucursal_id', 'sucursalId')
      .addSelect('SUM(m.busquedas)', 'totalBusquedas')
      .where('m.fecha >= DATE_SUB(CURDATE(), INTERVAL :dias DAY)', { dias })
      .groupBy('m.sucursal_id')
      .orderBy('totalBusquedas', 'DESC')
      .limit(limit * 3); // traemos más para luego filtrar por ciudad si aplica

    if (ciudadId) {
      qbMetrica.andWhere('m.ciudad_id = :ciudadId', { ciudadId });
    }

    const topMetricas = await qbMetrica.getRawMany<{
      sucursalId: string;
      totalBusquedas: string;
    }>();

    if (topMetricas.length === 0) return { items: [], total: 0, page: 1, limit };

    const sucursalIds = topMetricas.map((m) => Number(m.sucursalId));

    // 2. Cargar las sucursales con sus relaciones (mismo baseQuery)
    const qb = this.baseQuery()
      .andWhere('s.id IN (:...sucursalIds)', { sucursalIds });

    if (ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    const sucursales = await qb.getMany();

    // 3. Mantener el orden de las métricas (más buscadas primero)
    const ordenPorId = new Map(sucursalIds.map((id, i) => [id, i]));
    sucursales.sort(
      (a, b) => (ordenPorId.get(Number(a.id)) ?? 999) - (ordenPorId.get(Number(b.id)) ?? 999),
    );

    const items = (await this.mapear(sucursales)).slice(0, limit);

    return { items, total: items.length, page: 1, limit };
  }

  // ─── Más likes ──────────────────────────────────────────────────────────────

  async masLikes(params: { ciudadId?: number; limit: number }) {
    const { ciudadId, limit } = params;

    // Top sucursales por total de likes
    const qbLikes = this.likeRepo
      .createQueryBuilder('l')
      .select('l.sucursal_id', 'sucursalId')
      .addSelect('COUNT(l.id)', 'totalLikes')
      .groupBy('l.sucursal_id')
      .orderBy('totalLikes', 'DESC')
      .limit(limit * 3); // margen por si filtro de ciudad reduce resultados

    const topLikes = await qbLikes.getRawMany<{
      sucursalId: string;
      totalLikes: string;
    }>();

    if (topLikes.length === 0) return { items: [], total: 0, page: 1, limit };

    const sucursalIds = topLikes.map((l) => Number(l.sucursalId));

    const qb = this.baseQuery()
      .andWhere('s.id IN (:...sucursalIds)', { sucursalIds });

    if (ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    const sucursales = await qb.getMany();

    // Mantener orden: más likes primero
    const ordenPorId = new Map(sucursalIds.map((id, i) => [id, i]));
    sucursales.sort(
      (a, b) => (ordenPorId.get(Number(a.id)) ?? 999) - (ordenPorId.get(Number(b.id)) ?? 999),
    );

    // Añadir totalLikes al item para que el front pueda mostrarlo si quiere
    const likesMap = new Map(
      topLikes.map((l) => [Number(l.sucursalId), Number(l.totalLikes)]),
    );
    const mapped = await this.mapear(sucursales);
    const items = mapped
      .slice(0, limit)
      .map((item) => ({ ...item, totalLikes: likesMap.get(item.sucursalId) ?? 0 }));

    return { items, total: items.length, page: 1, limit };
  }

  // ─── Sugeridos (promo activa o más recientes) ────────────────────────────────

  async sugeridos(params: { ciudadId?: number; limit: number }) {
    const conPromo = await this.sugeridosConPromo(params);

    if (conPromo.length >= params.limit) {
      return {
        items: conPromo.slice(0, params.limit),
        total: conPromo.length,
        page: 1,
        limit: params.limit,
      };
    }

    const excluirIds = conPromo.map((s) => s.sucursalId);
    const recientes = await this.sugeridosRecientes(params, excluirIds);
    const items = [...conPromo, ...recientes].slice(0, params.limit);

    return { items, total: items.length, page: 1, limit: params.limit };
  }

  // ─── Base query ─────────────────────────────────────────────────────────────

  /**
   * Carga negocio, categoría, subcategoría (con su categoría padre) y ciudad.
   * El join a sub_cat (categoría padre de la subcategoría) permite filtrar
   * correctamente negocios que solo tienen subcategoria_id pero no categoria_id.
   */
  private baseQuery() {
    return this.sucursalRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.negocio', 'n', 'n.eliminado = 0')
      .leftJoinAndSelect('n.categoria', 'cat')
      .leftJoinAndSelect('n.subcategoria', 'sub')
      .leftJoinAndSelect('sub.categoria', 'sub_cat')   // ← categoría padre de la subcategoría
      .leftJoinAndSelect('n.especialidad', 'esp')
      .leftJoinAndSelect('s.ciudad', 'ciudad')
      .where('s.eliminado = 0');
  }

  // ─── Sugeridos helpers ───────────────────────────────────────────────────────

  private async sugeridosConPromo(params: { ciudadId?: number; limit: number }) {
    const qb = this.baseQuery().take(params.limit);

    if (params.ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId: params.ciudadId });
    }

    qb.innerJoin(
      'promociones_sucursales',
      'ps',
      `ps.sucursal_id = s.id
       AND ps.activa = 1
       AND (ps.fecha_inicio IS NULL OR ps.fecha_inicio <= NOW())
       AND (ps.fecha_fin   IS NULL OR ps.fecha_fin   >= NOW())`,
    );

    qb.orderBy('s.fechaRegistro', 'DESC');

    const sucursales = await qb.getMany();
    return this.mapear(sucursales);
  }

  private async sugeridosRecientes(
    params: { ciudadId?: number; limit: number },
    excluirIds: number[],
  ) {
    const qb = this.baseQuery().take(params.limit);

    if (params.ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId: params.ciudadId });
    }
    if (excluirIds.length > 0) {
      qb.andWhere('s.id NOT IN (:...excluirIds)', { excluirIds });
    }

    qb.orderBy('s.fechaRegistro', 'DESC');

    const sucursales = await qb.getMany();
    return this.mapear(sucursales);
  }

  // ─── Mapper ──────────────────────────────────────────────────────────────────

  private async mapear(sucursales: SucursalNegocio[]) {
    if (sucursales.length === 0) return [];

    const sucursalIds = sucursales.map((s) => Number(s.id));

    const horarios = await this.horarioRepo
      .createQueryBuilder('h')
      .innerJoinAndSelect('h.sucursal', 'hs')
      .where('hs.id IN (:...ids) AND h.eliminado = 0', { ids: sucursalIds })
      .getMany();

    const horariosBySucursal = new Map<number, HorarioSucursal[]>();
    for (const h of horarios) {
      const sid = Number(h.sucursal.id);
      if (!horariosBySucursal.has(sid)) horariosBySucursal.set(sid, []);
      horariosBySucursal.get(sid)!.push(h);
    }

    const { diaHoy, horaActual } = this.getNowLocal();

    return sucursales.map((s) => {
      const n      = s.negocio as any;
      const cat    = n?.categoria as any;
      const sub    = n?.subcategoria as any;
      // Categoría efectiva: la del negocio, o la de la subcategoría si el negocio no tiene
      const catEfectiva = cat ?? (sub as any)?.categoria;
      const esp    = n?.especialidad as any;
      const ciudad = s.ciudad as any;

      const horariosS = horariosBySucursal.get(Number(s.id)) ?? [];
      const { abiertoAhora, horaApertura, horaCierre } = this.calcularAbierto(
        horariosS,
        diaHoy,
        horaActual,
      );

      const direccion = [
        s.calle,
        s.numeroExterior ? `#${s.numeroExterior}`     : null,
        s.numeroInterior ? `Int. ${s.numeroInterior}` : null,
        s.colonia        ? `Col. ${s.colonia}`        : null,
      ]
        .filter(Boolean)
        .join(' ');

      return {
        sucursalId:     Number(s.id),
        negocioId:      Number(n?.id),
        nombreNegocio:  n?.nombreNegocio  ?? null,
        nombreSucursal: s.nombreSucursal,
        logoUrl:        n?.logoUrl        ?? null,
        imagenUrl:      s.imagenUrl       ?? null,
        categoria:      catEfectiva?.nombre ?? null,
        categoriaId:    catEfectiva?.id ? Number(catEfectiva.id) : null,
        subcategoria:   sub?.nombre       ?? null,
        subcategoriaId: sub?.id ? Number(sub.id) : null,
        especialidad:   esp?.nombre       ?? null,
        ciudad:         ciudad?.nombre    ?? null,
        ciudadId:       ciudad?.id ? Number(ciudad.id) : null,
        direccion,
        abiertoAhora,
        horaApertura,
        horaCierre,
      };
    });
  }

  // ─── Tiempo local ────────────────────────────────────────────────────────────

  private getNowLocal(): { diaHoy: string; horaActual: string } {
    const tz  = this.cfg.get<string>('APP_TIMEZONE') || 'America/Mazatlan';
    const now = new Date();

    const diaRaw = new Intl.DateTimeFormat('es-MX', {
      weekday:  'long',
      timeZone: tz,
    })
      .format(now)
      .toLowerCase();

    const diaMap: Record<string, string> = {
      lunes:     'Lunes',
      martes:    'Martes',
      miércoles: 'Miércoles',
      miercoles: 'Miércoles',
      jueves:    'Jueves',
      viernes:   'Viernes',
      sábado:    'Sábado',
      sabado:    'Sábado',
      domingo:   'Domingo',
    };

    const horaActual = new Intl.DateTimeFormat('en-GB', {
      hour:     '2-digit',
      minute:   '2-digit',
      second:   '2-digit',
      hour12:   false,
      timeZone: tz,
    }).format(now);

    return { diaHoy: diaMap[diaRaw] ?? diaRaw, horaActual };
  }

  // ─── Calcular si está abierto ─────────────────────────────────────────────────

  private calcularAbierto(
    horarios: HorarioSucursal[],
    diaHoy: string,
    horaActual: string,
  ): { abiertoAhora: boolean; horaApertura: string | null; horaCierre: string | null } {
    const horarioHoy = horarios.find(
      (h) => h.diaSemana === diaHoy && !h.cerrado,
    );

    if (!horarioHoy) {
      return { abiertoAhora: false, horaApertura: null, horaCierre: null };
    }

    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const ahora    = toMin(horaActual);
    const apertura = toMin(horarioHoy.horaApertura);
    const cierre   = toMin(horarioHoy.horaCierre);

    return {
      abiertoAhora: ahora >= apertura && ahora < cierre,
      horaApertura: horarioHoy.horaApertura.slice(0, 5),
      horaCierre:   horarioHoy.horaCierre.slice(0, 5),
    };
  }
}
