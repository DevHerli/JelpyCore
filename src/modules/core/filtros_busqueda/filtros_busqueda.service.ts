import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FiltrosBusquedaDto } from './dto/filtros-busqueda.dto';
import { VistaNegociosCompleta } from '../vista-completa/entities/vista-negocios.view';

@Injectable()
export class FiltrosBusquedaService {
  constructor(
    @InjectRepository(VistaNegociosCompleta)
    private readonly vistaRepo: Repository<VistaNegociosCompleta>,
  ) {}

  async buscar(filtros: FiltrosBusquedaDto) {
    const {
      termino,
      ciudadId,
      categoriaId,
      subcategoriaId,
      abiertoAhora,
      promocionesActivas,
      latitud,
      longitud,
    } = filtros;

    let query = this.vistaRepo
      .createQueryBuilder('v')
      .where('1 = 1');

    if (termino) {
      query.andWhere(
        `(v.nombre_negocio LIKE :t 
          OR v.categoria LIKE :t 
          OR v.subcategoria LIKE :t 
          OR v.especialidad LIKE :t)`,
        { t: `%${termino}%` },
      );
    }

    // OJO:
    // La vista actual NO tiene ciudad_id.
    // Por eso este filtro NO se puede usar todavía:
    // if (ciudadId) query.andWhere('v.ciudad_id = :ciudadId', { ciudadId });

    if (categoriaId) {
      query.andWhere('v.categoria_id = :categoriaId', { categoriaId });
    }

    if (subcategoriaId) {
      query.andWhere('v.subcategoria_id = :subcategoriaId', { subcategoriaId });
    }

    if (abiertoAhora) {
      const fecha = new Date();
      const horaActual = fecha.toTimeString().slice(0, 8);

      const dia = fecha.toLocaleString('es-MX', { weekday: 'long' }).toLowerCase();

      query.andWhere(
        `
        EXISTS (
          SELECT 1
          FROM horarios_sucursal hs
          WHERE hs.sucursal_id = v.sucursal_id
            AND hs.eliminado = 0
            AND hs.cerrado = 0
            AND LOWER(hs.dia_semana) = :dia
            AND :horaActual BETWEEN hs.hora_apertura AND hs.hora_cierre
        )
        `,
        {
          dia,
          horaActual,
        },
      );
    }

    if (promocionesActivas) {
      query.andWhere('v.promo_activa = 1');
    }

    const rowsRaw = await query.getRawMany();

    let rows = rowsRaw;

    if (latitud != null && longitud != null) {
      const toRad = (value: number) => (value * Math.PI) / 180;

      rows = rows
        .map((r) => {
          if (r.latitud != null && r.longitud != null) {
            const lat2 = Number(r.latitud);
            const lon2 = Number(r.longitud);

            const dLat = toRad(lat2 - Number(latitud));
            const dLon = toRad(lon2 - Number(longitud));

            const R = 6371;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(Number(latitud))) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;

            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const km = R * c;

            return { ...r, distancia_km: km };
          }

          return { ...r, distancia_km: null };
        })
        .filter((r) => r.distancia_km !== null)
        .sort((a, b) => a.distancia_km - b.distancia_km)
        .slice(0, 10);
    }

    const agrupados = Object.values(
      rows.reduce((acc: Record<number, any>, row: any) => {
        if (!acc[row.negocio_id]) {
          acc[row.negocio_id] = {
            negocio_id: row.negocio_id,
            nombre_negocio: row.nombre_negocio,
            categoria: row.categoria,
            subcategoria: row.subcategoria,
            especialidad: row.especialidad,
            ciudad: row.ciudad,
            distancia_km: row.distancia_km ?? null,
            sucursales: [],
            promociones: [],
          };
        }

        const sucursalYaExiste = acc[row.negocio_id].sucursales.some(
          (s: any) => s.sucursal_id === row.sucursal_id,
        );

        if (!sucursalYaExiste && row.sucursal_id) {
          acc[row.negocio_id].sucursales.push({
            sucursal_id: row.sucursal_id,
            nombre_sucursal: row.nombre_sucursal,
            latitud: row.latitud,
            longitud: row.longitud,
          });
        }

        if (row.promo_titulo) {
          const promoYaExiste = acc[row.negocio_id].promociones.some(
            (p: any) =>
              p.titulo === row.promo_titulo &&
              p.descripcion === row.promo_descripcion &&
              p.tipo === row.tipo_promocion,
          );

          if (!promoYaExiste) {
            acc[row.negocio_id].promociones.push({
              titulo: row.promo_titulo,
              descripcion: row.promo_descripcion,
              tipo: row.tipo_promocion,
            });
          }
        }

        return acc;
      }, {}),
    );

    return agrupados;
  }
}