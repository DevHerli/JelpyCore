import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { SucursalNegocio } from '../../business/sucursales_negocios/entities/sucursal-negocio.entity';
import { HorarioSucursal } from '../../business/horario_sucursal/entities/horarios-sucursal.entity';

@Injectable()
export class PublicSucursalesService {
  constructor(
    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(HorarioSucursal)
    private readonly horarioRepo: Repository<HorarioSucursal>,

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
    if (params.categoriaId) {
      qb.andWhere('cat.id = :categoriaId', { categoriaId: params.categoriaId });
    }
    if (params.subcategoriaId) {
      qb.andWhere('sub.id = :subcategoriaId', { subcategoriaId: params.subcategoriaId });
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

    // Solo negocios con membresía activa y pagada
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

  // ─── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Base query: carga las relaciones necesarias con joinAndSelect
   * para que TypeORM popule los objetos anidados (negocio, categoria, ciudad, etc.)
   */
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

  private async sugeridosConPromo(params: { ciudadId?: number; limit: number }) {
    const qb = this.baseQuery().take(params.limit);

    if (params.ciudadId) {
      qb.andWhere('ciudad.id = :ciudadId', { ciudadId: params.ciudadId });
    }

    // Sucursales con promoción activa en este momento
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

  private async mapear(sucursales: SucursalNegocio[]) {
    if (sucursales.length === 0) return [];

    const sucursalIds = sucursales.map((s) => Number(s.id));

    // Un solo query para todos los horarios, con join para obtener el sucursal_id
    const horarios = await this.horarioRepo
      .createQueryBuilder('h')
      .innerJoinAndSelect('h.sucursal', 'hs')
      .where('hs.id IN (:...ids) AND h.eliminado = 0', { ids: sucursalIds })
      .getMany();

    // Agrupar por sucursal_id
    const horariosBySucursal = new Map<number, HorarioSucursal[]>();
    for (const h of horarios) {
      const sid = Number(h.sucursal.id);
      if (!horariosBySucursal.has(sid)) horariosBySucursal.set(sid, []);
      horariosBySucursal.get(sid)!.push(h);
    }

    const { diaHoy, horaActual } = this.getNowLocal();

    return sucursales.map((s) => {
      const n       = s.negocio as any;
      const cat     = n?.categoria as any;
      const sub     = n?.subcategoria as any;
      const esp     = n?.especialidad as any;
      const ciudad  = s.ciudad as any;

      const horariosS = horariosBySucursal.get(Number(s.id)) ?? [];
      const { abiertoAhora, horaApertura, horaCierre } = this.calcularAbierto(
        horariosS,
        diaHoy,
        horaActual,
      );

      const direccion = [
        s.calle,
        s.numeroExterior  ? `#${s.numeroExterior}`      : null,
        s.numeroInterior  ? `Int. ${s.numeroInterior}`  : null,
        s.colonia         ? `Col. ${s.colonia}`         : null,
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
        categoria:      cat?.nombre       ?? null,
        categoriaId:    cat?.id ? Number(cat.id) : null,
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

  // ─── Tiempo local (igual que SearchService) ─────────────────────────────────

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

  // ─── Calcular si está abierto ────────────────────────────────────────────────

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
