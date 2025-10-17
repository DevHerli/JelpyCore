import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { KeywordTaxonomia } from '../../catalogos/taxonomia/entities/keyword-taxonomia.entity';
import { VistaNegociosCompleta } from '../vista-completa/entities/vista-negocios.view';
import { normalizeBasic } from '../../../common/utils/text.util';
import { containsProfanity } from '../../../common/utils/profanity.util';

type MatchHint = { tipo: 'categoria'|'subcategoria'|'especialidad', referencia_id: string, relevancia: number };

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(KeywordTaxonomia) private kwRepo: Repository<KeywordTaxonomia>,
    @InjectRepository(VistaNegociosCompleta) private vistaRepo: Repository<VistaNegociosCompleta>,
    private cfg: ConfigService,
  ) {}

  private getLocalNow(tz: string) {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('es-MX', {
      timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = fmt.formatToParts(now);
    const wd = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() || 'lunes';
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    // Pasamos sabado/domingo sin acentos para matchear ENUM si lo guardaste con acento:
    const mapDias: Record<string,string> = {
      'lunes':'lunes','martes':'martes','miércoles':'miércoles','miercoles':'miércoles',
      'jueves':'jueves','viernes':'viernes','sábado':'sábado','sabado':'sábado','domingo':'domingo'
    };
    return { dia: mapDias[wd] || 'lunes', time: `${hour}:${minute}:00` };
  }

  async search(params: { q?: string; ciudad?: string; abiertoAhora?: boolean; lat?: number; lng?: number; radioKm?: number; }) {
    const tz = this.cfg.get('APP_TIMEZONE') || 'America/Mazatlan';

    const qRaw = (params.q || '').slice(0, 140);
    if (!qRaw) return { items: [], info: { reason: 'empty_query' } };
    if (containsProfanity(qRaw)) {
      return { items: [], info: { blocked: true, reason: 'profanity' } };
    }

    const qNorm = normalizeBasic(qRaw); // "pediatria sushi tepic"
    // 1) Intento: hallar hints en keywords_taxonomia (buscamos por LIKE seguro)
    const hints = await this.kwRepo.createQueryBuilder('k')
      .where('k.keyword LIKE :kw', { kw: `%${qNorm.split(' ')[0]}%` }) // primera palabra
      .orWhere('k.keyword LIKE :kw2', { kw2: `%${qRaw}%` })
      .orderBy('k.relevancia', 'DESC')
      .limit(10)
      .getMany();

    // Elegimos el mejor hint (si existe)
    const best: MatchHint | undefined = hints.length
      ? { tipo: hints[0].tipo, referencia_id: hints[0].referencia_id, relevancia: hints[0].relevancia }
      : undefined;

    // 2) Armamos query a la vista
    const qb = this.vistaRepo.createQueryBuilder('v');

    if (params.ciudad) {
      qb.andWhere('v.ciudad = :ciudad', { ciudad: params.ciudad });
    }

    if (best) {
      // mapeamos segun el tipo
      if (best.tipo === 'especialidad') qb.andWhere('v.especialidad IS NOT NULL AND v.especialidad != ""');
      if (best.tipo === 'subcategoria') qb.andWhere('v.subcategoria IS NOT NULL AND v.subcategoria != ""');
      if (best.tipo === 'categoria')    qb.andWhere('v.categoria IS NOT NULL AND v.categoria != ""');
      // Nota: si necesitas matchear por nombre exacto de la taxonomía, puedes extender la vista
      // para traer los IDs; por ahora filtramos por presencia.
      // Como fallback, aplicamos un LIKE sobre los nombres:
      qb.andWhere(new Brackets(b => {
        b.where('v.especialidad LIKE :t', { t: `%${qNorm}%` })
         .orWhere('v.subcategoria LIKE :t', { t: `%${qNorm}%` })
         .orWhere('v.categoria LIKE :t',    { t: `%${qNorm}%` })
         .orWhere('v.nombre_negocio LIKE :t', { t: `%${qNorm}%` });
      }));
    } else {
      // Sin hint: buscamos por nombres y promos
      qb.andWhere(new Brackets(b => {
        b.where('v.nombre_negocio LIKE :t', { t: `%${qNorm}%` })
         .orWhere('v.especialidad LIKE :t', { t: `%${qNorm}%` })
         .orWhere('v.subcategoria LIKE :t', { t: `%${qNorm}%` })
         .orWhere('v.categoria LIKE :t',    { t: `%${qNorm}%` })
         .orWhere('v.promo_titulo LIKE :t', { t: `%${qNorm}%` });
      }));
    }

    if (params.abiertoAhora) {
      const { dia, time } = this.getLocalNow(tz);
      qb.andWhere('v.dia_semana = :dia', { dia });
      qb.andWhere(':now BETWEEN v.hora_apertura AND v.hora_cierre', { now: time });
    }

    // Promos activas hoy si el usuario busca "promo" en q
    if (qNorm.includes('promo')) {
      qb.andWhere('CURRENT_DATE() BETWEEN v.promo_fecha_inicio AND v.promo_fecha_fin');
    }

    // Cercanía (Haversine aprox). Si no hay lat/lng, no se aplica
    if (typeof params.lat === 'number' && typeof params.lng === 'number') {
      const lat = params.lat, lng = params.lng;
      const radioKm = params.radioKm ?? 10;
      qb.addSelect(`
        (111.111 * DEGREES(ACOS(LEAST(1.0,
          COS(RADIANS(:lat)) * COS(RADIANS(v.latitud)) * COS(RADIANS(:lng - v.longitud)) +
          SIN(RADIANS(:lat)) * SIN(RADIANS(v.latitud))
        ))))`, 'km');
      qb.setParameters({ lat, lng });
      qb.andWhere('v.latitud IS NOT NULL AND v.longitud IS NOT NULL');
      qb.having('km <= :r', { r: radioKm });
      qb.orderBy('km', 'ASC');
    } else {
      qb.orderBy('v.nombre_negocio', 'ASC');
    }

    qb.limit(50);

    const rows = await qb.getRawAndEntities();
    const items = rows.entities.map((e: VistaNegociosCompleta, idx: number) => ({
      nombre_negocio: e.nombre_negocio,
      sucursal: e.nombre_sucursal,
      ciudad: e.ciudad,
      categoria: e.categoria,
      subcategoria: e.subcategoria,
      especialidad: e.especialidad,
      abierto: !!(e.hora_apertura && e.hora_cierre), // indicativo simple
      promo: e.promo_titulo ? { titulo: e.promo_titulo, desde: e.promo_fecha_inicio, hasta: e.promo_fecha_fin } : null,
      distancia_km: (rows.raw[idx]?.km ? Number(rows.raw[idx].km.toFixed?.(2) ?? rows.raw[idx].km) : undefined),
    }));

    return {
      items,
      info: {
        matched: best ?? null,
        count: items.length,
        ciudad: params.ciudad || null,
        abiertoAhora: !!params.abiertoAhora,
      }
    };
  }
}
