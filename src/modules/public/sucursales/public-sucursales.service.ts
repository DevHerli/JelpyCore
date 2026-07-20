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
      qb.andWhere(
        `(cat.id = :categoriaId OR EXISTS (
          SELECT 1 FROM subcategorias sc
          WHERE sc.id = sub.id AND sc.categoria_id = :categoriaId
        ))`,
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

  // ─── Más buscados ────────────────────────────────────────────────────────────

  async masBuscados(params: { ciudadId?: number; limit: number; dias: number }) {
    const { ciudadId, limit, dias } = params;

    // 1️⃣ Primario: histórico con ventana de tiempo.
    // Se envuelve en try/catch: si la tabla histórica está vacía o su esquema
    // no coincide (p. ej. falta ciudad_id), degradamos limpiamente al fallback.
    let topMetricas: Array<{ sucursalId: string; totalBusquedas: string }> = [];
    try {
      const qbMetrica = this.metricaRepo
        .createQueryBuilder('m')
        .select('m.sucursal_id', 'sucursalId')
        .addSelect('SUM(m.busquedas)', 'totalBusquedas')
        .where('m.fecha >= DATE_SUB(CURDATE(), INTERVAL :dias DAY)', { dias })
        .groupBy('m.sucursal_id')
        .orderBy('totalBusquedas', 'DESC')
        .limit(limit * 3);

      if (ciudadId) {
        qbMetrica.andWhere('m.ciudad_id = :ciudadId', { ciudadId });
      }

      topMetricas = await qbMetrica.getRawMany<{
        sucursalId: string;
        totalBusquedas: string;
      }>();
    } catch {
      topMetricas = [];
    }

    if (topMetricas.length === 0) {
      // 2️⃣ Fallback: estadisticas_sucursales (acumulado all-time)
      // No tiene ciudad_id — se obtiene ranking global y baseQuery filtra por ciudad
      const rankRows: Array<{ sucursalId: string }> =
        await this.metricaRepo.manager.query(
          `SELECT sucursal_id AS sucursalId
           FROM estadisticas_sucursales
           ORDER BY busquedas DESC, vistas DESC, clics DESC
           LIMIT ?`,
          [limit * 5],
        );

      if (rankRows.length === 0) {
        // 3️⃣ Último recurso: sucursales más recientes
        const qbRecientes = this.baseQuery().take(limit).orderBy('s.id', 'DESC');
        if (ciudadId) qbRecientes.andWhere('ciudad.id = :ciudadId', { ciudadId });
        const recientes = await qbRecientes.getMany();
        const itemsRecientes = await this.mapear(recientes);
        return { items: itemsRecientes, total: itemsRecientes.length, page: 1, limit };
      }

      const fallbackIds = rankRows.map((r: any) => Number(r.sucursalId));
      const qbFallback = this.baseQuery().andWhere('s.id IN (:...sucursalIds)', { sucursalIds: fallbackIds });
      if (ciudadId) qbFallback.andWhere('ciudad.id = :ciudadId', { ciudadId });

      const sucursalesFallback = await qbFallback.getMany();
      const ordenFallback = new Map(fallbackIds.map((id, i) => [id, i]));
      sucursalesFallback.sort(
        (a, b) => (ordenFallback.get(Number(a.id)) ?? 999) - (ordenFallback.get(Number(b.id)) ?? 999),
      );
      const itemsFallback = (await this.mapear(sucursalesFallback)).slice(0, limit);
      return { items: itemsFallback, total: itemsFallback.length, page: 1, limit };
    }

    const sucursalIds = topMetricas.map((m) => Number(m.sucursalId));

    const qb = this.baseQuery().andWhere('s.id IN (:...sucursalIds)', { sucursalIds });

    if (ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    const sucursales = await qb.getMany();

    const ordenPorId = new Map(sucursalIds.map((id, i) => [id, i]));
    sucursales.sort(
      (a, b) => (ordenPorId.get(Number(a.id)) ?? 999) - (ordenPorId.get(Number(b.id)) ?? 999),
    );

    const items = (await this.mapear(sucursales)).slice(0, limit);
    return { items, total: items.length, page: 1, limit };
  }

  // ─── Más likes ───────────────────────────────────────────────────────────────

  async masLikes(params: { ciudadId?: number; limit: number }) {
    const { ciudadId, limit } = params;

    const topLikes = await this.likeRepo
      .createQueryBuilder('l')
      .select('l.sucursal_id', 'sucursalId')
      .addSelect('COUNT(l.id)', 'totalLikes')
      .groupBy('l.sucursal_id')
      .orderBy('totalLikes', 'DESC')
      .limit(limit * 3)
      .getRawMany<{ sucursalId: string; totalLikes: string }>();

    if (topLikes.length === 0) return { items: [], total: 0, page: 1, limit };

    const sucursalIds = topLikes.map((l) => Number(l.sucursalId));

    const qb = this.baseQuery().andWhere('s.id IN (:...sucursalIds)', { sucursalIds });

    if (ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    const sucursales = await qb.getMany();

    const ordenPorId = new Map(sucursalIds.map((id, i) => [id, i]));
    sucursales.sort(
      (a, b) => (ordenPorId.get(Number(a.id)) ?? 999) - (ordenPorId.get(Number(b.id)) ?? 999),
    );

    const likesMap = new Map(topLikes.map((l) => [Number(l.sucursalId), Number(l.totalLikes)]));
    const mapped = await this.mapear(sucursales);
    const items = mapped
      .slice(0, limit)
      .map((item) => ({ ...item, totalLikes: likesMap.get(item.sucursalId) ?? 0 }));

    return { items, total: items.length, page: 1, limit };
  }

  // ─── Sugeridos ───────────────────────────────────────────────────────────────

  async sugeridos(params: { ciudadId?: number; limit: number }) {
    const conPromo = await this.sugeridosConPromo(params);

    if (conPromo.length >= params.limit) {
      return { items: conPromo.slice(0, params.limit), total: conPromo.length, page: 1, limit: params.limit };
    }

    const excluirIds = conPromo.map((s) => s.sucursalId);
    const recientes = await this.sugeridosRecientes(params, excluirIds);
    const items = [...conPromo, ...recientes].slice(0, params.limit);

    return { items, total: items.length, page: 1, limit: params.limit };
  }

  // ─── Base query ──────────────────────────────────────────────────────────────

  private baseQuery() {
    return this.sucursalRepo
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.negocio', 'n', 'n.eliminado = 0')
      .leftJoinAndSelect('n.categoria', 'cat')
      .leftJoinAndSelect('n.subcategoria', 'sub')
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

  private async sugeridosRecientes(params: { ciudadId?: number; limit: number }, excluirIds: number[]) {
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

    const subIdsNeedingCat = [
      ...new Set(
        sucursales
          .filter((s) => !(s.negocio as any)?.categoria && (s.negocio as any)?.subcategoria?.id)
          .map((s) => Number((s.negocio as any).subcategoria.id)),
      ),
    ];

    const subCatMap = new Map<number, { catId: number; catNombre: string }>();

    if (subIdsNeedingCat.length > 0) {
      const rows: Array<{ subId: string; catId: string; catNombre: string }> =
        await this.sucursalRepo.manager.query(
          `SELECT sc.id AS subId, c.id AS catId, c.nombre AS catNombre
           FROM subcategorias sc
           INNER JOIN categorias c ON c.id = sc.categoria_id
           WHERE sc.id IN (${subIdsNeedingCat.map(() => '?').join(',')})`,
          subIdsNeedingCat,
        );
      for (const row of rows) {
        subCatMap.set(Number(row.subId), { catId: Number(row.catId), catNombre: row.catNombre });
      }
    }

    const { diaHoy, horaActual } = this.getNowLocal();

    return sucursales.map((s) => {
      const n      = s.negocio as any;
      const cat    = n?.categoria as any;
      const sub    = n?.subcategoria as any;
      const esp    = n?.especialidad as any;
      const ciudad = s.ciudad as any;

      const catEfectiva = cat
        ? { id: Number(cat.id), nombre: cat.nombre }
        : sub?.id
          ? subCatMap.get(Number(sub.id)) ?? null
          : null;

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
        categoria:      (catEfectiva as any)?.catNombre ?? (catEfectiva as any)?.nombre ?? null,
        categoriaId:    (catEfectiva as any)?.catId    ?? (catEfectiva as any)?.id      ?? null,
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

    const diaRaw = new Intl.DateTimeFormat('es-MX', { weekday: 'long', timeZone: tz })
      .format(now)
      .toLowerCase();

    const diaMap: Record<string, string> = {
      lunes: 'Lunes', martes: 'Martes',
      miércoles: 'Miércoles', miercoles: 'Miércoles',
      jueves: 'Jueves', viernes: 'Viernes',
      sábado: 'Sábado', sabado: 'Sábado',
      domingo: 'Domingo',
    };

    const horaActual = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: tz,
    }).format(now);

    return { diaHoy: diaMap[diaRaw] ?? diaRaw, horaActual };
  }

  // ─── Calcular si está abierto ─────────────────────────────────────────────────

  private calcularAbierto(
    horarios: HorarioSucursal[],
    diaHoy: string,
    horaActual: string,
  ): { abiertoAhora: boolean; horaApertura: string | null; horaCierre: string | null } {
    const horarioHoy = horarios.find((h) => h.diaSemana === diaHoy && !h.cerrado);

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
