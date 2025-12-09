import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { KeywordTaxonomia } from '../taxonomia/entities/keyword-taxonomia.entity';
import { VistaNegociosCompleta } from '../vista-completa/entities/vista-negocios.view';
import { normalizeBasic } from '../../../common/utils/text.util';
import { containsProfanity } from '../../../common/utils/profanity.util';

type MatchHint = {
  tipo: 'categoria' | 'subcategoria' | 'especialidad';
  referencia_id: number;
  relevancia: number;
};

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(KeywordTaxonomia)
    private kwRepo: Repository<KeywordTaxonomia>,

    @InjectRepository(VistaNegociosCompleta)
    private vistaRepo: Repository<VistaNegociosCompleta>,

    private cfg: ConfigService,
  ) {}

  private readonly stopwords: string[] = [
    'en','de','del','la','el','los','las','un','una','unos','unas',
    'y','o','para','por','con','sin','que',
    'quiero','busco','buscar','donde','dónde',
    'hay','me','mi','mí',
    'cerca','cerquita',
    'abierto','abiertos','ahora','ahorita',
    'promos','promo','oferta','ofertas',
    'descuento','descuentos',
  ];

  private generateMisspellings(word: string): string[] {
    const variantes = new Set<string>();
    const w = word.toLowerCase();

    if (w.length <= 2) return [];

    variantes.add(w.replace(/s/g, 'z'));
    variantes.add(w.replace(/z/g, 's'));
    variantes.add(w.replace(/c/g, 's'));
    variantes.add(w.replace(/sh/g, 'ch'));
    variantes.add(w.replace(/ch/g, 'sh'));

    variantes.add(w.replace(/[aeiouáéíóú]/g, ''));

    if (w.length > 3) {
      variantes.add(w.slice(1));
      variantes.add(w.slice(0, -1));
    }

    variantes.add(w + w[w.length - 1]);

    return [...variantes].filter((v) => v && v.length > 2 && v !== w);
  }

  private getLocalNow(tz: string) {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('es-MX', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = fmt.formatToParts(now);
    const wd =
      parts.find((p) => p.type === 'weekday')?.value?.toLowerCase() || 'lunes';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';

    const mapDias: Record<string, string> = {
      lunes: 'lunes', martes: 'martes',
      miércoles: 'miércoles', miercoles: 'miércoles',
      jueves: 'jueves', viernes: 'viernes',
      sábado: 'sábado', sabado: 'sábado',
      domingo: 'domingo',
    };

    return { dia: mapDias[wd] || 'lunes', time: `${hour}:${minute}:00` };
  }

  /** 🔥 Genera mensaje estilo Google Maps */
  private formatMensajeHorario(apertura: string, cierre: string, tz: string) {
    if (!apertura || !cierre) return null;

    const now = this.getLocalNow(tz);
    const current = now.time;

    if (current >= apertura && current <= cierre) {
      return `Abierto ahora — Cierra a las ${cierre.slice(0, 5)} hrs`;
    }

    if (current < apertura) {
      return `Cerrado — Abre a las ${apertura.slice(0, 5)} hrs`;
    }

    return `Cerrado — Abre mañana a las ${apertura.slice(0, 5)} hrs`;
  }

  async search(params: {
    q?: string;
    ciudad?: string;
    abiertoAhora?: boolean;
    abierto24h?: boolean;
    urgencias?: boolean;
    domicilio?: boolean;
    lat?: number;
    lng?: number;
    radioKm?: number;
    categoriaId?: number;
    subcategoriaId?: number;
    especialidadId?: number;
    promos?: boolean;
  }) {
    const tz = this.cfg.get('APP_TIMEZONE') || 'America/Mazatlan';

    const qRaw = (params.q || '').slice(0, 140);
    if (!qRaw) return { items: [], info: { reason: 'empty_query' } };
    if (containsProfanity(qRaw)) {
      return { items: [], info: { blocked: true, reason: 'profanity' } };
    }

    const qNorm = normalizeBasic(qRaw);

    const baseTokens = qNorm
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !this.stopwords.includes(t));

    let hints: KeywordTaxonomia[] = [];

    if (baseTokens.length > 0) {
      const hintsQb = this.kwRepo.createQueryBuilder('k');
      hintsQb.where('1=0');

      baseTokens.forEach((tk, idx) => {
        const param = `t${idx}`;
        hintsQb.orWhere(
          `
          REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            LOWER(k.keyword),
            'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u')
          LIKE :${param}
        `,
          { [param]: `%${tk}%` },
        );
      });

      hints = await hintsQb
        .orderBy('k.relevancia', 'DESC')
        .limit(10)
        .getMany();
    } else {
      hints = await this.kwRepo
        .createQueryBuilder('k')
        .where('k.keyword LIKE :w', { w: `%${qNorm}%` })
        .orderBy('k.relevancia', 'DESC')
        .limit(10)
        .getMany();
    }

    const best: MatchHint | undefined = hints.length
      ? {
          tipo: hints[0].tipo,
          referencia_id: hints[0].referenciaId,
          relevancia: hints[0].relevancia,
        }
      : undefined;

    const qb = this.vistaRepo.createQueryBuilder('v');

    if (params.ciudad) {
      qb.andWhere('v.ciudad = :ciudad', { ciudad: params.ciudad });
    }

    const tieneTaxonomia =
      !!params.categoriaId || !!params.subcategoriaId || !!params.especialidadId;

    if (params.categoriaId) {
      qb.andWhere('v.categoria_id = :categoriaId', { categoriaId: params.categoriaId });
    }
    if (params.subcategoriaId) {
      qb.andWhere('v.subcategoria_id = :subcategoriaId', { subcategoriaId: params.subcategoriaId });
    }
    if (params.especialidadId) {
      qb.andWhere('v.especialidad_id = :especialidadId', { especialidadId: params.especialidadId });
    }

    if (!tieneTaxonomia) {
      const tokensConVariantes = new Set<string>();
      baseTokens.forEach((tk) => {
        tokensConVariantes.add(tk);
        this.generateMisspellings(tk).forEach((v) => tokensConVariantes.add(v));
      });

      const tokens = [...tokensConVariantes];

      if (tokens.length === 0) {
        qb.andWhere(
          new Brackets((b) => {
            b.where('v.nombre_negocio LIKE :t', { t: `%${qNorm}%` })
              .orWhere('v.especialidad LIKE :t', { t: `%${qNorm}%` })
              .orWhere('v.subcategoria LIKE :t', { t: `%${qNorm}%` })
              .orWhere('v.categoria LIKE :t', { t: `%${qNorm}%` })
              .orWhere('v.promo_titulo LIKE :t', { t: `%${qNorm}%` });
          }),
        );
      } else {
        qb.andWhere(
          new Brackets((b) => {
            tokens.forEach((token, idx) => {
              const p = `tk${idx}`;
              b.orWhere(
                new Brackets((b2) =>
                  b2
                    .where(`v.nombre_negocio LIKE :${p}`)
                    .orWhere(`v.especialidad LIKE :${p}`)
                    .orWhere(`v.subcategoria LIKE :${p}`)
                    .orWhere(`v.categoria LIKE :${p}`)
                    .orWhere(`v.promo_titulo LIKE :${p}`),
                ),
                { [p]: `%${token}%` },
              );
            });
          }),
        );
      }
    }

    if (params.abiertoAhora) {
      const { dia, time } = this.getLocalNow(tz);
      qb.andWhere('v.dia_semana = :dia', { dia });
      qb.andWhere(':now BETWEEN v.hora_apertura AND v.hora_cierre', { now: time });
    }

    if (params.abierto24h) {
      qb.andWhere('v.hora_apertura = "00:00:00" AND v.hora_cierre = "23:59:59"');
    }

    if (params.urgencias) {
      qb.andWhere('v.atiende_urgencias = 1');
    }

    if (params.domicilio) {
      qb.andWhere('v.servicio_domicilio = 1');
    }

    if (params.promos) {
      qb.andWhere('CURRENT_DATE() BETWEEN v.promo_fecha_inicio AND v.promo_fecha_fin');
    }

    if (typeof params.lat === 'number' && typeof params.lng === 'number') {
      const radioKm = params.radioKm ?? 10;

      qb.addSelect(
        `
        (111.111 * DEGREES(ACOS(LEAST(1.0,
          COS(RADIANS(:lat)) * COS(RADIANS(v.latitud)) *
          COS(RADIANS(:lng - v.longitud)) +
          SIN(RADIANS(:lat)) * SIN(RADIANS(v.latitud))
        ))))
      `,
        'km',
      )
        .setParameters({ lat: params.lat, lng: params.lng })
        .andWhere('v.latitud IS NOT NULL AND v.longitud IS NOT NULL')
        .having('km <= :r', { r: radioKm })
        .orderBy('km', 'ASC');
    } else {
      qb.orderBy('v.promo_titulo IS NOT NULL', 'DESC');
      qb.addOrderBy('v.nombre_negocio', 'ASC');
    }

    qb.limit(50);

    const rows = await qb.getRawAndEntities();

    const items = rows.entities.map((e: VistaNegociosCompleta, idx: number) => ({
      negocio_id: e.negocio_id,
      nombre_negocio: e.nombre_negocio,
      sucursal: e.nombre_sucursal,
      ciudad: e.ciudad,

      categoria_id: e.categoria_id,
      subcategoria_id: e.subcategoria_id,
      especialidad_id: e.especialidad_id,

      categoria: e.categoria,
      subcategoria: e.subcategoria,
      especialidad: e.especialidad,

      latitud: e.latitud ? Number(e.latitud) : null,
      longitud: e.longitud ? Number(e.longitud) : null,

      abierto: !!(e.hora_apertura && e.hora_cierre),

      /** 🔥 AGREGADO: HORARIO DETALLADO */
      horario: {
        apertura: e.hora_apertura ?? null,
        cierre: e.hora_cierre ?? null,
        mensaje: this.formatMensajeHorario(e.hora_apertura, e.hora_cierre, tz),
      },

      promo: e.promo_titulo
        ? {
            titulo: e.promo_titulo,
            desde: e.promo_fecha_inicio,
            hasta: e.promo_fecha_fin,
          }
        : null,

      distancia_km:
        rows.raw[idx]?.km !== undefined && rows.raw[idx]?.km !== null
          ? Number(Number(rows.raw[idx].km).toFixed(2))
          : null,
    }));

    const mapa = new Map<string, any>();
    for (const item of items) {
      const key = `${item.negocio_id}-${item.sucursal}`;
      if (!mapa.has(key)) mapa.set(key, item);
    }

    const itemsUnicos = Array.from(mapa.values());

    return {
      items: itemsUnicos,
      info: {
        matched: best ?? null,
        count: itemsUnicos.length,
        ciudad: params.ciudad || null,
        abiertoAhora: !!params.abiertoAhora,
        abierto24h: !!params.abierto24h,
        urgencias: !!params.urgencias,
        domicilio: !!params.domicilio,
        promos: !!params.promos,
      },
    };
  }
}
