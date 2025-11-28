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

    // =============
    // BASE
    // =============
    let query = this.vistaRepo
      .createQueryBuilder('v')
      .where('1 = 1');

    // ============================
    //  FILTROS DINÁMICOS
    // ============================

    if (termino) {
      query.andWhere(`
        (v.nombre_negocio LIKE :t 
        OR v.categoria LIKE :t 
        OR v.subcategoria LIKE :t 
        OR v.especialidad LIKE :t)
      `, { t: `%${termino}%` });
    }

    if (ciudadId) query.andWhere('v.ciudad_id = :ciudadId', { ciudadId });
    if (categoriaId) query.andWhere('v.categoria_id = :categoriaId', { categoriaId });
    if (subcategoriaId) query.andWhere('v.subcategoria_id = :subcategoriaId', { subcategoriaId });

    // ============================
    // EJECUTAR CONSULTA
    // ============================
    let rows = await query.getRawMany();

    // ============================
    // ABIERTO AHORA
    // ============================
    if (abiertoAhora) {
      const fecha = new Date();
      const horaActual = fecha.toTimeString().slice(0, 5);

      const dia = fecha.toLocaleString('es-MX', { weekday: 'long' }).toLowerCase();
      const map: any = {
        lunes: 'Lunes',
        martes: 'Martes',
        miércoles: 'Miércoles',
        miercoles: 'Miércoles',
        jueves: 'Jueves',
        viernes: 'Viernes',
        sábado: 'Sábado',
        sabado: 'Sábado',
        domingo: 'Domingo',
      };

      const diaSql = map[dia];

      rows = rows.filter(
        (r) =>
          r.dia_semana === diaSql &&
          r.cerrado === 0 &&
          horaActual >= r.hora_apertura &&
          horaActual <= r.hora_cierre,
      );
    }

    // ============================
    // PROMOCIONES ACTIVAS
    // ============================
    if (promocionesActivas) {
      rows = rows.filter((r) => r.promo_activa === 1);
    }

    // ============================
    // CERCANOS
    // ============================
    if (latitud && longitud) {
      const toRad = (v) => (v * Math.PI) / 180;

      rows = rows
        .map((r) => {
          if (r.latitud && r.longitud) {
            const lat2 = Number(r.latitud);
            const lon2 = Number(r.longitud);

            const dLat = toRad(lat2 - latitud);
            const dLon = toRad(lon2 - longitud);

            const R = 6371;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(latitud)) *
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

    // AGRUPAR POR NEGOCIO (una sucursal → varias filas)
    const agrupados = Object.values(
      rows.reduce((acc, row) => {
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

        acc[row.negocio_id].sucursales.push({
          sucursal_id: row.sucursal_id,
          nombre_sucursal: row.nombre_sucursal,
          latitud: row.latitud,
          longitud: row.longitud,
        });

        if (row.promo_titulo) {
          acc[row.negocio_id].promociones.push({
            titulo: row.promo_titulo,
            descripcion: row.promo_descripcion,
            tipo: row.tipo_promocion,
          });
        }

        return acc;
      }, {}),
    );

    return agrupados;
  }
}
