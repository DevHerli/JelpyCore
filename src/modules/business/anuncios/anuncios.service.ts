import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';

import { CreateAnuncioDto } from './dtos/create-anuncio.dto';
import { UpdateAnuncioStatusDto } from './dtos/update-anuncio-status.dto';
import { TrackAnuncioEventDto } from './dtos/track-anuncio-event.dto';

import { v2 as cloudinary } from 'cloudinary';

import { Anuncio } from './entities/anuncio.entity';
import { AnuncioEvento } from './entities/anuncio-evento.entity';
import { AnuncioCupoMensual } from './entities/anuncio-cupo-mensual.entity';
import { AnuncioAddon } from './entities/anuncio-addon.entity';

import { Negocio } from '../negocios/entities/negocio.entity';
import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';
import { Membresia } from '../membresias/entities/membresia.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { UpdateAnuncioDto } from './dtos/update-anuncio.dto';

type DashboardResponse = {
  anunciosActivos: number;
  limiteMensual: number;
  limiteLabel: string;
  usedQuota: number;
  progressValue: number;
  canCreateAd: boolean;

  activos: Array<{
    id: number;
    titulo: string;
    descripcion?: string;
    imagen?: string;
    fechaInicio: string;
    fechaFin: string;
    status: string;
    statusLabel: string;
  }>;

  inactivos: Array<{
    id: number;
    titulo: string;
    descripcion?: string;
    imagen?: string;
    fechaInicio: string;
    fechaFin: string;
    status: string;
    statusLabel: string;
  }>;

  metricas: {
    vistas: number;
    clicks: number;
    likes: number;
  };
};

@Injectable()
export class AnunciosService {
  constructor(
    @InjectRepository(Anuncio)
    private readonly anuncioRepo: Repository<Anuncio>,

    @InjectRepository(AnuncioEvento)
    private readonly eventoRepo: Repository<AnuncioEvento>,

    @InjectRepository(AnuncioCupoMensual)
    private readonly cupoRepo: Repository<AnuncioCupoMensual>,

    @InjectRepository(AnuncioAddon)
    private readonly addonRepo: Repository<AnuncioAddon>,

    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    @InjectRepository(Membresia)
    private readonly membresiaRepo: Repository<Membresia>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,
  ) {}

  // -----------------------------
  // DASHBOARD (FIX: programados NO van a historial)
  // -----------------------------
  async getDashboard(negocioId: number): Promise<DashboardResponse> {
    const negocio = await this.negocioRepo.findOne({
      where: { id: negocioId, eliminado: false as any },
      relations: ['suscriptor', 'suscriptor.membresia'],
    });

    if (!negocio) throw new NotFoundException('Negocio no encontrado.');

    const now = new Date();
    const { year, month } = this.getYearMonth(now);

    const cupo = await this.ensureMonthlyQuota(negocioId, year, month);
    const unlimited = this.isUnlimitedMembership(negocio?.suscriptor?.membresia);

    // 1) Activos EN CURSO: active && inicio <= now && fin > now
    const activosEnCurso = await this.anuncioRepo.find({
      where: {
        negocio: { id: negocioId } as any,
        eliminado: false as any,
        status: 'active',
        fechaInicio: LessThan(now) as any,
        fechaFin: MoreThan(now) as any,
      },
      order: { fechaInicio: 'DESC' },
    });

    // 2) Programados (EDITABLES): active && inicio > now && fin > now
    //    (Si fin <= now, realmente ya está vencido)
    const programados = await this.anuncioRepo.find({
      where: {
        negocio: { id: negocioId } as any,
        eliminado: false as any,
        status: 'active',
        fechaInicio: MoreThan(now) as any,
        fechaFin: MoreThan(now) as any,
      },
      order: { fechaInicio: 'ASC' }, // opcional: ver primero el que inicia antes
    });

    // ✅ Activos = en curso + programados (NO van a historial)
    const activos = [...activosEnCurso, ...programados].sort((a, b) => {
      // Orden consistente: más cercano primero por inicio
      return new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime();
    });

    // 3) Historial / Inactivos:
    //    - finished / rejected
    //    - vencidos (fechaFin <= now) sin importar status
    //    - paused/draft (si los quieres en historial visual, se quedan aquí; son editables, eso lo controla el front luego)
    const inactivos = await this.anuncioRepo.find({
      where: [
        { negocio: { id: negocioId } as any, eliminado: false as any, status: 'paused' } as any,
        { negocio: { id: negocioId } as any, eliminado: false as any, status: 'finished' } as any,
        { negocio: { id: negocioId } as any, eliminado: false as any, status: 'rejected' } as any,
        { negocio: { id: negocioId } as any, eliminado: false as any, status: 'draft' } as any,

        // ✅ Vencidos (cualquier status, ya expiró)
        { negocio: { id: negocioId } as any, eliminado: false as any, fechaFin: LessThan(now) as any } as any,
      ],
      order: { fechaFin: 'DESC' },
      take: 50,
    });

    const ids = [...activos, ...inactivos].map((a) => a.id);
    const metricas = await this.getMetricsForAds(ids, year, month);

    const limiteMensual = (cupo.baseQuota || 0) + (cupo.addonQuota || 0);
    const usedQuota = cupo.usedQuota || 0;

    const progressValue = unlimited
      ? 0
      : (limiteMensual > 0 ? Math.min(1, usedQuota / limiteMensual) : 0);

    return {
      anunciosActivos: activos.length,
      limiteMensual,
      limiteLabel: unlimited ? 'Ilimitados' : `${limiteMensual}`,
      usedQuota,
      progressValue,
      canCreateAd: unlimited ? true : usedQuota < limiteMensual,

      activos: activos.map((a) => this.mapAnuncio(a)),
      inactivos: inactivos.map((a) => this.mapAnuncio(a)),

      metricas,
    };
  }

  // -----------------------------
  // CREATE (draft)
  // -----------------------------
  async create(dto: CreateAnuncioDto) {
    const negocio = await this.negocioRepo.findOne({
      where: { id: dto.negocioId, eliminado: false as any },
      relations: ['suscriptor', 'suscriptor.membresia'],
    });
    if (!negocio) throw new NotFoundException('Negocio no encontrado.');

    if (dto.sucursalId) {
      const sucursal = await this.sucursalRepo.findOne({
        where: { id: dto.sucursalId, eliminado: false as any } as any,
        relations: ['negocio'],
      });
      if (!sucursal) throw new NotFoundException('Sucursal no encontrada.');
      if (sucursal.negocio?.id !== negocio.id) {
        throw new BadRequestException('La sucursal no pertenece al negocio.');
      }
    }

    const fechaInicio = new Date(dto.fechaInicio);
    const fechaFin = new Date(dto.fechaFin);

    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
      throw new BadRequestException('Fechas inválidas.');
    }
    if (fechaFin <= fechaInicio) {
      throw new BadRequestException('fechaFin debe ser mayor que fechaInicio.');
    }

    const anuncio = this.anuncioRepo.create({
      negocio,
      sucursal: dto.sucursalId ? ({ id: dto.sucursalId } as any) : undefined,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      imagenUrl: dto.imagenUrl,
      fechaInicio,
      fechaFin,
      status: 'draft',
      eliminado: false,
      cupoConsumido: false,
      placement: dto.placement ?? null,
      ciudadId: dto.ciudadId ?? null,
      categoria: dto.categoria ?? null,
      ctaLabel: dto.ctaLabel ?? null,
      externalUrl: dto.externalUrl ?? null,
    });

    const saved = await this.anuncioRepo.save(anuncio);
    return { message: 'Anuncio creado en borrador.', anuncioId: saved.id };
  }

  // -----------------------------
  // UPDATE STATUS
  // -----------------------------
  async updateStatus(anuncioId: number, dto: UpdateAnuncioStatusDto) {
    const anuncio = await this.anuncioRepo.findOne({
      where: { id: anuncioId, eliminado: false as any } as any,
      relations: ['negocio', 'negocio.suscriptor', 'negocio.suscriptor.membresia'],
    });
    if (!anuncio) throw new NotFoundException('Anuncio no encontrado.');

    const prev = anuncio.status;
    const next = dto.status;

    if (next === 'active' && prev !== 'active') {
      const now = new Date();

      if (anuncio.fechaFin <= now) {
        throw new BadRequestException('No puedes activar un anuncio ya vencido.');
      }

      // --- Validaciones de placement / tier (si el anuncio tiene placement asignado) ---
      if (anuncio.placement) {
        const pubRows: any[] = await this.anuncioRepo.manager.query(
          `SELECT mp.placements_permitidos, mp.max_slots_simultaneos, mp.prioridad
           FROM negocios n
           INNER JOIN suscriptores s   ON s.id  = n.suscriptor_id
           INNER JOIN membresia_publicidad mp ON mp.membresia_id = s.membresia_id
           WHERE n.id = ? AND n.eliminado = 0
           LIMIT 1`,
          [anuncio.negocio.id],
        );

        if (pubRows.length > 0) {
          const reglas = pubRows[0];
          const placementsPermitidos: string[] =
            typeof reglas.placements_permitidos === 'string'
              ? JSON.parse(reglas.placements_permitidos)
              : reglas.placements_permitidos;

          // 1. Validar placement permitido
          if (!placementsPermitidos.includes(anuncio.placement)) {
            throw new ForbiddenException({ error: 'PLACEMENT_NO_PERMITIDO' });
          }

          // 2. Validar max_slots_simultaneos
          const [slotRow]: any[] = await this.anuncioRepo.manager.query(
            `SELECT COUNT(*) AS total
             FROM anuncios
             WHERE negocio_id = ?
               AND status    = 'active'
               AND placement = ?
               AND fecha_inicio <= NOW()
               AND fecha_fin    >= NOW()
               AND eliminado    = 0
               AND id != ?`,
            [anuncio.negocio.id, anuncio.placement, anuncio.id],
          );

          if (Number(slotRow.total) >= Number(reglas.max_slots_simultaneos)) {
            throw new ConflictException({ error: 'LIMITE_SLOTS' });
          }

          // 3. Snapshot de prioridad desde el tier
          anuncio.prioridad = Number(reglas.prioridad);
        }
      }

      // --- Cupo mensual ---
      const membresia = anuncio?.negocio?.suscriptor?.membresia as any;
      const ilimitado = this.isUnlimitedMembership(membresia);

      if (!ilimitado && !anuncio.cupoConsumido) {
        const { year, month } = this.getYearMonth(now);
        const cupo = await this.ensureMonthlyQuota(anuncio.negocio.id, year, month);
        const limite = (cupo.baseQuota || 0) + (cupo.addonQuota || 0);

        if ((cupo.usedQuota || 0) >= limite) {
          throw new BadRequestException(
            'Has agotado tu cupo mensual de anuncios. Contrata más anuncios para continuar.',
          );
        }

        cupo.usedQuota = (cupo.usedQuota || 0) + 1;
        await this.cupoRepo.save(cupo);

        anuncio.cupoConsumido = true;
      }
    }

    anuncio.status = next;
    const saved = await this.anuncioRepo.save(anuncio);

    return {
      message: `Estatus actualizado: ${prev} -> ${next}`,
      anuncio: this.mapAnuncio(saved),
    };
  }

  // -----------------------------
  // TRACK EVENT
  // -----------------------------
  async trackEvent(anuncioId: number, dto: TrackAnuncioEventDto) {
    const anuncio = await this.anuncioRepo.findOne({
      where: { id: anuncioId, eliminado: false as any } as any,
      relations: ['negocio'],
    });
    if (!anuncio) throw new NotFoundException('Anuncio no encontrado.');

    const evento = this.eventoRepo.create({
      anuncio: { id: anuncioId } as any,
      eventType: dto.eventType,
      suscriptor: dto.suscriptorId ? ({ id: dto.suscriptorId } as any) : undefined,
    });

    await this.eventoRepo.save(evento);
    return { message: 'Evento registrado.' };
  }

  // -----------------------------
  // HELPERS
  // -----------------------------
private mapAnuncio(a: Anuncio) {
  const nowMs = Date.now();
  const inicioMs = new Date(a.fechaInicio).getTime();
  const finMs = new Date(a.fechaFin).getTime();

  const isScheduled = a.status === 'active' && inicioMs > nowMs;
  const isExpired = finMs <= nowMs;

  let statusLabel = this.statusLabel(a.status);
  if (isExpired) statusLabel = 'Vencido';
  else if (isScheduled) statusLabel = 'Programado';

  return {
    id: a.id,
    titulo: a.titulo,
    descripcion: a.descripcion,
    imagen: a.imagenUrl || null,
    fechaInicio: this.toISODate(a.fechaInicio),
    fechaFin: this.toISODate(a.fechaFin),
    status: a.status,
    statusLabel,
  };
}


  private statusLabel(status: string) {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'active': return 'Activo';
      case 'paused': return 'Pausado';
      case 'finished': return 'Finalizado';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  }

  private toISODate(d: Date) {
    return new Date(d).toISOString();
  }

  private getYearMonth(date: Date) {
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  }

  private isUnlimitedMembership(membresia: any): boolean {
    if (!membresia) return false;
    if (membresia.anunciosIlimitados === true) return true;
    if (membresia.anuncios_ilimitados === 1 || membresia.anuncios_ilimitados === true) return true;
    const nombre = (membresia.nombre || '').toString().toLowerCase();
    return nombre.includes('cortes');
  }

  private async ensureMonthlyQuota(negocioId: number, year: number, month: number) {
    let cupo = await this.cupoRepo.findOne({
      where: { negocio: { id: negocioId } as any, year, month } as any,
      relations: ['negocio'],
    });

    if (!cupo) {
      const negocio = await this.negocioRepo.findOne({
        where: { id: negocioId, eliminado: false as any } as any,
        relations: ['suscriptor', 'suscriptor.membresia'],
      });

      if (!negocio) throw new NotFoundException('Negocio no encontrado para cupo.');

      const baseQuota =
        (negocio.suscriptor?.membresia as any)?.anuncios_mensuales ??
        (negocio.suscriptor?.membresia as any)?.anunciosMensuales ??
        0;

      cupo = this.cupoRepo.create({
        negocio: { id: negocioId } as any,
        year,
        month,
        baseQuota: Number(baseQuota) || 0,
        addonQuota: 0,
        usedQuota: 0,
      });

      cupo = await this.cupoRepo.save(cupo);
    }

    const addonsPaid = await this.addonRepo
      .createQueryBuilder('a')
      .select('COALESCE(SUM(a.quantity), 0)', 'sum')
      .where('a.negocio_id = :negocioId', { negocioId })
      .andWhere('a.year = :year', { year })
      .andWhere('a.month = :month', { month })
      .andWhere('a.status = :status', { status: 'paid' })
      .getRawOne<{ sum: string }>();

    const addonTotal = Number(addonsPaid?.sum ?? 0);

    if (cupo.addonQuota !== addonTotal) {
      cupo.addonQuota = addonTotal;
      cupo = await this.cupoRepo.save(cupo);
    }

    const negocioForBase = await this.negocioRepo.findOne({
      where: { id: negocioId, eliminado: false as any } as any,
      relations: ['suscriptor', 'suscriptor.membresia'],
    });

    const baseQuotaNow =
      (negocioForBase?.suscriptor?.membresia as any)?.anuncios_mensuales ??
      (negocioForBase?.suscriptor?.membresia as any)?.anunciosMensuales ??
      0;

    const baseQuotaNum = Number(baseQuotaNow) || 0;
    if (cupo.baseQuota !== baseQuotaNum) {
      cupo.baseQuota = baseQuotaNum;
      cupo = await this.cupoRepo.save(cupo);
    }

    return cupo;
  }

  private async getMetricsForAds(adIds: number[], year: number, month: number) {
    if (!adIds.length) return { vistas: 0, clicks: 0, likes: 0 };

    const start = new Date(year, month - 1, 1, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0);

    const rows = await this.eventoRepo
      .createQueryBuilder('e')
      .select('e.event_type', 'event_type')
      .addSelect('COUNT(*)', 'total')
      .where('e.anuncio_id IN (:...ids)', { ids: adIds })
      .andWhere('e.created_at BETWEEN :start AND :end', { start, end })
      .groupBy('e.event_type')
      .getRawMany<{ event_type: string; total: string }>();

    const agg = new Map<string, number>();
    rows.forEach((r) => agg.set(r.event_type, Number(r.total)));

    return {
      vistas: agg.get('view') ?? 0,
      clicks: agg.get('click') ?? 0,
      likes: agg.get('like') ?? 0,
    };
  }

  async updateAdImage(anuncioId: number, imagenUrl: string, publicId?: string) {
    if (!imagenUrl) throw new BadRequestException('imagenUrl es requerida');

    const anuncio = await this.anuncioRepo.findOne({
      where: { id: anuncioId, eliminado: false as any } as any,
    });
    if (!anuncio) throw new NotFoundException('Anuncio no encontrado.');

    const prevPublicId = (anuncio as any).imagenPublicId;

    anuncio.imagenUrl = imagenUrl;
    if (publicId) (anuncio as any).imagenPublicId = publicId;

    const saved = await this.anuncioRepo.save(anuncio);

    if (prevPublicId && prevPublicId !== publicId) {
      try {
        await cloudinary.uploader.destroy(prevPublicId);
      } catch (e) {
        console.warn('No se pudo borrar imagen anterior en Cloudinary:', e);
      }
    }

    return {
      message: 'Imagen del anuncio actualizada.',
      anuncio: this.mapAnuncio(saved),
    };
  }

  async findOne(id: number) {
    const ad = await this.anuncioRepo.findOne({
      where: { id, eliminado: false },
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        imagenUrl: true,
        imagenPublicId: true,
        fechaInicio: true,
        fechaFin: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        cupoConsumido: true,
        eliminado: true,
      },
      relations: {
        negocio: true,
        sucursal: true,
      },
    });

    if (!ad) throw new NotFoundException('Anuncio no encontrado');

    return {
      id: ad.id,
      titulo: ad.titulo,
      descripcion: ad.descripcion ?? '',
      imagen: ad.imagenUrl ?? null,
      fechaInicio: ad.fechaInicio,
      fechaFin: ad.fechaFin,
      status: ad.status,
      statusLabel: ad.status, // o tu lógica real de label
      // si quieres, también regresa estos:
      imagenUrl: ad.imagenUrl ?? null,
      imagenPublicId: ad.imagenPublicId ?? null,
    };
  }

  async update(id: number, dto: UpdateAnuncioDto) {
    const ad = await this.anuncioRepo.findOne({ where: { id, eliminado: false } });
    if (!ad) throw new NotFoundException('Anuncio no encontrado');

    if (dto.titulo       !== undefined) ad.titulo       = dto.titulo;
    if (dto.descripcion  !== undefined) ad.descripcion  = dto.descripcion;
    if (dto.imagenUrl    !== undefined) ad.imagenUrl    = dto.imagenUrl    ?? null;
    if (dto.imagenPublicId !== undefined) ad.imagenPublicId = dto.imagenPublicId ?? null;
    if (dto.fechaInicio  !== undefined) ad.fechaInicio  = new Date(dto.fechaInicio);
    if (dto.fechaFin     !== undefined) ad.fechaFin     = new Date(dto.fechaFin);

    await this.anuncioRepo.save(ad);
    return { message: 'Anuncio actualizado' };
  }

  // -----------------------------------------------------------------------
  // FEED PÚBLICO — GET /ads/public
  // -----------------------------------------------------------------------
  async getPublicAds(params: {
    placement: string;
    ciudadId?: number;
    categoria?: string;
    limit?: number;
  }) {
    const { placement, ciudadId, categoria, limit = 5 } = params;

    const qParams: any[] = [placement];
    let ciudadFilter = '';
    if (ciudadId) {
      ciudadFilter = 'AND (a.ciudad_id = ? OR a.ciudad_id IS NULL)';
      qParams.push(ciudadId);
    }

    let categoriaFilter = '';
    if (categoria) {
      categoriaFilter = 'AND (a.categoria = ? OR a.categoria IS NULL)';
      qParams.push(categoria);
    }

    qParams.push(limit);

    // ROW_NUMBER() particiona por negocio y limita a max_slots_simultaneos del tier.
    // Si el negocio no tiene regla en membresia_publicidad, COALESCE usa 999 (sin límite).
    const rows: any[] = await this.anuncioRepo.manager.query(
      `SELECT t.id, t.title, t.description, t.imageUrl, t.ctaLabel,
              t.sponsorName, t.placement, t.internalRoute, t.externalUrl,
              t.negocioId, t.sucursalId
       FROM (
         SELECT
           a.id,
           a.titulo                                              AS title,
           a.descripcion                                         AS description,
           a.imagen_url                                          AS imageUrl,
           a.cta_label                                           AS ctaLabel,
           a.placement,
           a.external_url                                        AS externalUrl,
           CASE WHEN a.sucursal_id IS NOT NULL
                THEN CONCAT('/branch/branch-detail/', a.sucursal_id)
                ELSE NULL END                                    AS internalRoute,
           a.negocio_id                                          AS negocioId,
           a.sucursal_id                                         AS sucursalId,
           a.prioridad,
           n.nombre_negocio                                      AS sponsorName,
           ROW_NUMBER() OVER (
             PARTITION BY a.negocio_id ORDER BY a.prioridad DESC
           )                                                      AS rn,
           COALESCE(mp.max_slots_simultaneos, 999)               AS max_slots
         FROM anuncios a
         INNER JOIN negocios n    ON n.id  = a.negocio_id AND n.eliminado = 0
         LEFT  JOIN suscriptores s ON s.id = n.suscriptor_id
         LEFT  JOIN membresia_publicidad mp ON mp.membresia_id = s.membresia_id
         WHERE a.status       = 'active'
           AND a.placement    = ?
           AND a.fecha_inicio <= NOW()
           AND a.fecha_fin    >= NOW()
           AND a.eliminado    = 0
           ${ciudadFilter}
           ${categoriaFilter}
       ) t
       WHERE t.rn <= t.max_slots
       ORDER BY t.prioridad DESC, RAND()
       LIMIT ?`,
      qParams,
    );

    return { items: rows };
  }

  // -----------------------------------------------------------------------
  // TRACKING — POST /ads/:id/impression  |  POST /ads/:id/click
  // -----------------------------------------------------------------------
  async impression(adId: number) {
    await this.anuncioRepo.manager.query(
      'UPDATE anuncios SET vistas = vistas + 1 WHERE id = ? AND eliminado = 0',
      [adId],
    );
    return { ok: true };
  }

  async click(adId: number) {
    await this.anuncioRepo.manager.query(
      'UPDATE anuncios SET clicks = clicks + 1 WHERE id = ? AND eliminado = 0',
      [adId],
    );
    return { ok: true };
  }

  // -----------------------------------------------------------------------
  // PLACEMENTS PERMITIDOS — GET /ads/placements-permitidos/:negocioId
  // -----------------------------------------------------------------------
  async getPlacementsPermitidos(negocioId: number) {
    const rows: any[] = await this.anuncioRepo.manager.query(
      `SELECT
         mp.placements_permitidos,
         mp.max_slots_simultaneos,
         (
           SELECT COUNT(*) FROM anuncios a
           WHERE a.negocio_id   = ?
             AND a.status       = 'active'
             AND a.fecha_inicio <= NOW()
             AND a.fecha_fin    >= NOW()
             AND a.eliminado    = 0
         ) AS usados
       FROM negocios n
       INNER JOIN suscriptores s          ON s.id  = n.suscriptor_id
       INNER JOIN membresia_publicidad mp ON mp.membresia_id = s.membresia_id
       WHERE n.id = ? AND n.eliminado = 0
       LIMIT 1`,
      [negocioId, negocioId],
    );

    if (!rows.length) {
      return { placementsPermitidos: [], maxSlotsSimultaneos: 0, usados: 0 };
    }

    const r = rows[0];
    const placementsPermitidos: string[] =
      typeof r.placements_permitidos === 'string'
        ? JSON.parse(r.placements_permitidos)
        : r.placements_permitidos;

    return {
      placementsPermitidos,
      maxSlotsSimultaneos: Number(r.max_slots_simultaneos),
      usados: Number(r.usados),
    };
  }
}
