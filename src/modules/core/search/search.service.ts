import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { KeywordTaxonomia } from '../taxonomia/entities/keyword-taxonomia.entity';
import { VistaNegociosCompleta } from '../vista-completa/entities/vista-negocios.view';
import { normalizeBasic } from '../../../common/utils/text.util';
import { containsProfanity } from '../../../common/utils/profanity.util';
import { ItemNegocio } from '../../business/catalogo_productos/entities/item-negocio.entity';

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

    @InjectRepository(ItemNegocio)
    private itemRepo: Repository<ItemNegocio>,

    private cfg: ConfigService,
  ) {}

  private readonly stopwords: string[] = [
    'en', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'y', 'o', 'para', 'por', 'con', 'sin', 'que',
    'quiero', 'busco', 'buscar', 'donde', 'dónde',
    'hay', 'me', 'mi', 'mí',
    'cerca', 'cerquita',
    'abierto', 'abiertos', 'ahora', 'ahorita',
    'promos', 'promo', 'oferta', 'ofertas',
    'descuento', 'descuentos',
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
      lunes: 'lunes',
      martes: 'martes',
      miércoles: 'miércoles',
      miercoles: 'miércoles',
      jueves: 'jueves',
      viernes: 'viernes',
      sábado: 'sábado',
      sabado: 'sábado',
      domingo: 'domingo',
    };

    return { dia: mapDias[wd] || 'lunes', time: `${hour}:${minute}:00` };
  }

  /** Genera mensaje estilo Google Maps */
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
    caracteristica?: string;
  }) {
    const tz = this.cfg.get('APP_TIMEZONE') || 'America/Mazatlan';

    const qRaw = (params.q || '').slice(0, 140);
    const qNorm = normalizeBasic(qRaw);

    const caracteristicaNorm = params.caracteristica
      ? normalizeBasic(params.caracteristica)
      : '';

    // Quitamos la característica del texto libre para que no contamine
    // el bloque OR general cuando ya va filtrada aparte como AND.
    const qNormLimpio =
      caracteristicaNorm && qNorm
        ? qNorm.replace(caracteristicaNorm, '').replace(/\s+/g, ' ').trim()
        : qNorm;

    const tieneTaxonomia =
      !!params.categoriaId || !!params.subcategoriaId || !!params.especialidadId;

    if (!qRaw && !params.promos && !tieneTaxonomia) {
      return { items: [], info: { reason: 'empty_query' } };
    }

    if (qRaw && containsProfanity(qRaw)) {
      return { items: [], info: { blocked: true, reason: 'profanity' } };
    }

    const baseTokens = qNormLimpio
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
    } else if (qNormLimpio) {
      hints = await this.kwRepo
        .createQueryBuilder('k')
        .where('k.keyword LIKE :w', { w: `%${qNormLimpio}%` })
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

    if (params.categoriaId) {
      qb.andWhere('v.categoria_id = :categoriaId', {
        categoriaId: params.categoriaId,
      });
    }

    if (params.subcategoriaId) {
      qb.andWhere('v.subcategoria_id = :subcategoriaId', {
        subcategoriaId: params.subcategoriaId,
      });
    }

    if (params.especialidadId) {
      qb.andWhere('v.especialidad_id = :especialidadId', {
        especialidadId: params.especialidadId,
      });
    }

    // FILTRO OBLIGATORIO POR CARACTERÍSTICA
    // Esto hace que solo salgan sucursales que realmente tengan esa característica.
    if (params.caracteristica) {
      qb.andWhere('v.caracteristicas_keywords LIKE :caracteristica', {
        caracteristica: `%${caracteristicaNorm}%`,
      });
    }

    const esBusquedaGenericaDePromos =
      !!params.promos &&
      (!qNormLimpio ||
        [
          'promocion',
          'promociones',
          'promo',
          'promos',
          'oferta',
          'ofertas',
          'descuento',
          'descuentos',
        ].includes(qNormLimpio));

    // Solo aplicar filtro textual si NO hay taxonomía.
    // Si ya viene categoria/subcategoria/especialidad, dejamos que la taxonomía mande.
    // Pero si ya viene params.caracteristica, evitamos volver a usar
    // caracteristicas_keywords dentro del OR porque ya está filtrada arriba con AND.
    if (!tieneTaxonomia && qNormLimpio && !esBusquedaGenericaDePromos) {
      const tokensConVariantes = new Set<string>();

      baseTokens.forEach((tk) => {
        tokensConVariantes.add(tk);
        this.generateMisspellings(tk).forEach((v) => tokensConVariantes.add(v));
      });

      const tokens = [...tokensConVariantes];

      if (tokens.length === 0) {
        qb.andWhere(
          new Brackets((b) => {
            b.where('v.nombre_negocio LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.nombre_sucursal LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.especialidad LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.subcategoria LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.categoria LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.promo_titulo LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.catalogo_keywords LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.anuncio_keywords LIKE :t', { t: `%${qNormLimpio}%` })
              .orWhere('v.items_keywords LIKE :t', { t: `%${qNormLimpio}%` });

            if (!params.caracteristica) {
              b.orWhere('v.caracteristicas_keywords LIKE :t', {
                t: `%${qNormLimpio}%`,
              });
            }
          }),
        );
      } else {
        qb.andWhere(
          new Brackets((b) => {
            tokens.forEach((token, idx) => {
              const p = `tk${idx}`;

              b.orWhere(
                new Brackets((b2) => {
                  b2.where(`v.nombre_negocio LIKE :${p}`)
                    .orWhere(`v.nombre_sucursal LIKE :${p}`)
                    .orWhere(`v.especialidad LIKE :${p}`)
                    .orWhere(`v.subcategoria LIKE :${p}`)
                    .orWhere(`v.categoria LIKE :${p}`)
                    .orWhere(`v.promo_titulo LIKE :${p}`)
                    .orWhere(`v.catalogo_keywords LIKE :${p}`)
                    .orWhere(`v.anuncio_keywords LIKE :${p}`)
                    .orWhere(`v.items_keywords LIKE :${p}`);

                  if (!params.caracteristica) {
                    b2.orWhere(`v.caracteristicas_keywords LIKE :${p}`);
                  }
                }),
                { [p]: `%${token}%` },
              );
            });
          }),
        );
      }
    }

    if (params.abiertoAhora) {
      const { dia, time } = this.getLocalNow(tz);

      qb.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM horarios_sucursal hs
          WHERE hs.sucursal_id = v.sucursal_id
            AND hs.eliminado = 0
            AND LOWER(hs.dia_semana) = :dia
            AND hs.cerrado = 0
            AND :now BETWEEN hs.hora_apertura AND hs.hora_cierre
        )
      `,
        {
          dia,
          now: time,
        },
      );
    }

    if (params.abierto24h) {
      qb.andWhere(`
        EXISTS (
          SELECT 1
          FROM horarios_sucursal hs24
          WHERE hs24.sucursal_id = v.sucursal_id
            AND hs24.eliminado = 0
            AND hs24.cerrado = 0
            AND hs24.hora_apertura = '00:00:00'
            AND hs24.hora_cierre IN ('23:59:00', '23:59:59')
        )
      `);
    }

    if (params.urgencias) {
      qb.andWhere('v.atiende_urgencias = 1');
    }

    if (params.domicilio) {
      qb.andWhere('v.servicio_domicilio = 1');
    }

    if (params.promos) {
      qb.andWhere('v.promo_titulo IS NOT NULL');
      qb.andWhere('v.promo_activa = 1');
      qb.andWhere(
        'CURRENT_DATE() BETWEEN v.promo_fecha_inicio AND v.promo_fecha_fin',
      );
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

      if (params.promos) {
        qb.addOrderBy('v.promo_fecha_inicio', 'DESC');
        qb.addOrderBy('v.nombre_negocio', 'ASC');
      } else {
        qb.addOrderBy('v.nombre_negocio', 'ASC');
      }
    } else {
      if (params.promos) {
        qb.orderBy('v.promo_fecha_inicio', 'DESC');
        qb.addOrderBy('v.nombre_negocio', 'ASC');
      } else {
        qb.orderBy('v.promo_titulo IS NOT NULL', 'DESC');
        qb.addOrderBy('v.nombre_negocio', 'ASC');
      }
    }

    qb.limit(50);

    const rows = await qb.getRawAndEntities();

    const items = rows.entities.map((e: VistaNegociosCompleta, idx: number) => {
      const horarioInfo = this.buildHorarioDesdeKeywords(e.horarios_keywords);

      return {
        negocio_id: e.negocio_id,
        nombre_negocio: e.nombre_negocio,
        sucursal: e.nombre_sucursal,
        sucursal_id: e.sucursal_id,
        ciudadId: e.ciudad_id,
        ciudad: e.ciudad,

        categoria_id: e.categoria_id,
        subcategoria_id: e.subcategoria_id,
        especialidad_id: e.especialidad_id,

        categoria: e.categoria,
        subcategoria: e.subcategoria,
        especialidad: e.especialidad,

        latitud: e.latitud ? Number(e.latitud) : null,
        longitud: e.longitud ? Number(e.longitud) : null,

        abierto: horarioInfo.abiertoTexto,
        estadoIcono: horarioInfo.estadoIcono,
        horario: horarioInfo.horario,

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
      };
    });

    const mapa = new Map<string, any>();
    for (const item of items) {
      const key = `${item.negocio_id}-${item.sucursal_id}`;
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

  private getNowInMexico(): { dayKey: string; time: string } {
    const now = new Date();

    const weekday = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      timeZone: 'America/Mazatlan',
    }).format(now).toLowerCase();

    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'America/Mazatlan',
    }).format(now);

    const map: Record<string, string> = {
      lunes: 'lunes',
      martes: 'martes',
      miércoles: 'miercoles',
      miercoles: 'miercoles',
      jueves: 'jueves',
      viernes: 'viernes',
      sábado: 'sabado',
      sabado: 'sabado',
      domingo: 'domingo',
    };

    return {
      dayKey: map[weekday] ?? weekday,
      time,
    };
  }

  private normalizeDay(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private parseHorariosKeywords(horariosKeywords?: string | null) {
    if (!horariosKeywords) return [];

    return horariosKeywords
      .split(' | ')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const parts = chunk.split(' ').filter(Boolean);

        if (parts.length < 4) return null;

        const diaSemana = parts[0];
        const horaApertura = parts[1];
        const horaCierre = parts[2];
        const cerrado = Number(parts[3]) === 1;

        return {
          diaSemana,
          dayKey: this.normalizeDay(diaSemana),
          horaApertura,
          horaCierre,
          cerrado,
        };
      })
      .filter(Boolean) as Array<{
        diaSemana: string;
        dayKey: string;
        horaApertura: string;
        horaCierre: string;
        cerrado: boolean;
      }>;
  }

  private formatHora12h(hora?: string | null): string | null {
    if (!hora) return null;

    const [hh, mm] = hora.split(':');
    const h = Number(hh);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;

    return `${hour12}:${mm} ${suffix}`;
  }

  private buildHorarioDesdeKeywords(horariosKeywords?: string | null) {
    const horarios = this.parseHorariosKeywords(horariosKeywords);
    const { dayKey, time } = this.getNowInMexico();

    const hoy = horarios.find((h) => h.dayKey === dayKey);

    if (!hoy) {
      return {
        abiertoTexto: 'Horario no disponible',
        estadoIcono: 'unknown',
        horario: {
          apertura: null,
          cierre: null,
          mensaje: 'Horario no disponible',
        },
      };
    }

    const aperturaFmt = this.formatHora12h(hoy.horaApertura);
    const cierreFmt = this.formatHora12h(hoy.horaCierre);

    if (hoy.cerrado) {
      return {
        abiertoTexto: 'Cerrado hoy',
        estadoIcono: 'closed',
        horario: {
          apertura: aperturaFmt,
          cierre: cierreFmt,
          mensaje: 'Hoy permanece cerrado',
        },
      };
    }

    const abiertoAhora = time >= hoy.horaApertura && time <= hoy.horaCierre;

    let mensaje = '';

    if (abiertoAhora) {
      mensaje = `Abierto ahora — Cierra a las ${cierreFmt}`;
    } else if (time < hoy.horaApertura) {
      mensaje = `Cerrado — Abre hoy a las ${aperturaFmt}`;
    } else {
      mensaje = `Cerrado — Abre mañana a las ${aperturaFmt}`;
    }

    return {
      abiertoTexto: abiertoAhora ? 'Abierto ahora' : 'Cerrado',
      estadoIcono: abiertoAhora ? 'open' : 'closed',
      horario: {
        apertura: aperturaFmt,
        cierre: cierreFmt,
        mensaje,
      },
    };
  }

  async searchByItems(params: {
    q?: string;
    ciudad?: string;
    lat?: number;
    lng?: number;
    radioKm?: number;
  }) {
    const qRaw = (params.q || '').slice(0, 140);
    const qNorm = normalizeBasic(qRaw);

    if (!qNorm) {
      return {
        items: [],
        info: {
          reason: 'empty_query',
          source: 'items_negocio',
        },
      };
    }

    const baseTokens = qNorm
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !this.stopwords.includes(t));

    const tokensConVariantes = new Set<string>();

    baseTokens.forEach((tk) => {
      tokensConVariantes.add(tk);
      this.generateMisspellings(tk).forEach((v) => tokensConVariantes.add(v));
    });

    const tokens = [...tokensConVariantes];
    const qb = this.vistaRepo.createQueryBuilder('v');

    qb.innerJoin(
      'items_negocio',
      'it',
      'it.negocio_id = v.negocio_id AND it.activo = 1',
    );

    if (params.ciudad) {
      qb.andWhere('v.ciudad = :ciudad', { ciudad: params.ciudad });
    }

    if (tokens.length === 0) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(it.nombre) LIKE :q', { q: `%${qNorm}%` })
            .orWhere('LOWER(COALESCE(it.descripcion, "")) LIKE :q', {
              q: `%${qNorm}%`,
            });
        }),
      );
    } else {
      qb.andWhere(
        new Brackets((b) => {
          tokens.forEach((token, idx) => {
            const p = `itk${idx}`;
            b.orWhere(
              new Brackets((b2) => {
                b2.where(`LOWER(it.nombre) LIKE :${p}`)
                  .orWhere(`LOWER(COALESCE(it.descripcion, "")) LIKE :${p}`);
              }),
              { [p]: `%${token}%` },
            );
          });
        }),
      );
    }

    qb.addSelect('it.id', 'item_id');
    qb.addSelect('it.nombre', 'item_nombre');
    qb.addSelect('it.descripcion', 'item_descripcion');
    qb.addSelect('it.precio_base', 'item_precio_base');
    qb.addSelect('it.tipo', 'item_tipo');
    qb.addSelect('it.imagen_url', 'item_imagen_url');

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
        .orderBy('km', 'ASC')
        .addOrderBy('v.nombre_negocio', 'ASC');
    } else {
      qb.orderBy('v.nombre_negocio', 'ASC');
    }

    qb.limit(50);

    const rows = await qb.getRawAndEntities();

    const items = rows.entities.map((e: VistaNegociosCompleta, idx: number) => {
      const horarioInfo = this.buildHorarioDesdeKeywords(e.horarios_keywords);
      const raw = rows.raw[idx];

      return {
        negocio_id: e.negocio_id,
        nombre_negocio: e.nombre_negocio,
        sucursal: e.nombre_sucursal,
        sucursal_id: e.sucursal_id,

        ciudadId: e.ciudad_id,
        ciudad: e.ciudad,

        categoria_id: e.categoria_id,
        subcategoria_id: e.subcategoria_id,
        especialidad_id: e.especialidad_id,

        categoria: e.categoria,
        subcategoria: e.subcategoria,
        especialidad: e.especialidad,

        latitud: e.latitud ? Number(e.latitud) : null,
        longitud: e.longitud ? Number(e.longitud) : null,

        abierto: horarioInfo.abiertoTexto,
        estadoIcono: horarioInfo.estadoIcono,
        horario: horarioInfo.horario,

        item: {
          id: raw.item_id ? Number(raw.item_id) : null,
          nombre: raw.item_nombre ?? null,
          descripcion: raw.item_descripcion ?? null,
          precioBase:
            raw.item_precio_base != null ? Number(raw.item_precio_base) : null,
          tipo: raw.item_tipo ?? null,
          imagenUrl: raw.item_imagen_url ?? null,
        },

        promo: e.promo_titulo
          ? {
              titulo: e.promo_titulo,
              desde: e.promo_fecha_inicio,
              hasta: e.promo_fecha_fin,
            }
          : null,

        distancia_km:
          raw?.km !== undefined && raw?.km !== null
            ? Number(Number(raw.km).toFixed(2))
            : null,
      };
    });

    const mapa = new Map<string, any>();

    for (const item of items) {
      const key = `${item.negocio_id}-${item.sucursal_id}-${item.item?.id}`;
      if (!mapa.has(key)) {
        mapa.set(key, item);
      }
    }

    const itemsUnicos = Array.from(mapa.values());

    return {
      items: itemsUnicos,
      info: {
        source: 'items_negocio',
        count: itemsUnicos.length,
        ciudad: params.ciudad || null,
      },
    };
  }
}