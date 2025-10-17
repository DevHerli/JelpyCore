import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FiltrosBusquedaDto } from './dto/filtros-busqueda.dto';
import { Negocio } from '../../business/negocios/entities/negocio.entity';
import { PromocionSucursal } from '../../business/promociones_sucursal/entities/promocion-sucursal.entity';
import { HorarioSucursal } from '../../business/horario_sucursal/entities/horarios-sucursal.entity';
import { SucursalNegocio } from '../../business/sucursales_negocios/entities/sucursal-negocio.entity';

@Injectable()
export class FiltrosBusquedaService {
  constructor(
    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(PromocionSucursal)
    private readonly promoRepo: Repository<PromocionSucursal>,

    @InjectRepository(HorarioSucursal)
    private readonly horarioRepo: Repository<HorarioSucursal>,
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

    // 🔹 1. Construcción base de la consulta
    let query = this.negocioRepo
      .createQueryBuilder('negocio')
      .leftJoinAndSelect('negocio.membresia', 'membresia')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
      .leftJoinAndSelect('negocio.especialidad', 'especialidad')
      .leftJoinAndSelect('negocio.estado', 'estado')
      .leftJoinAndSelect('negocio.sucursales', 'sucursales')
      .where('negocio.eliminado = 0');

    // 🔹 2. Aplicar filtros dinámicos
    if (termino) {
      query.andWhere(
        '(negocio.nombreNegocio LIKE :t OR categoria.nombre LIKE :t OR subcategoria.nombre LIKE :t)',
        { t: `%${termino}%` },
      );
    }

    if (ciudadId) query.andWhere('negocio.ciudad_id = :ciudadId', { ciudadId });
    if (categoriaId) query.andWhere('negocio.categoria_id = :categoriaId', { categoriaId });
    if (subcategoriaId) query.andWhere('negocio.subcategoria_id = :subcategoriaId', { subcategoriaId });

    let negocios = await query.getMany();

    // 🔹 3. Filtro: abierto ahora
    if (abiertoAhora) {
      const ahora = new Date();
      const horaActual = ahora.toTimeString().slice(0, 5);
      let dia = ahora.toLocaleString('es-MX', { weekday: 'long' }).toLowerCase();

      const mapDias: Record<string, string> = {
        lunes: 'Lunes',
        martes: 'Martes',
        miercoles: 'Miércoles',
        miércoles: 'Miércoles',
        jueves: 'Jueves',
        viernes: 'Viernes',
        sabado: 'Sábado',
        sábado: 'Sábado',
        domingo: 'Domingo',
      };
      dia = mapDias[dia] || 'Lunes';

      const abiertos: Negocio[] = [];
      for (const n of negocios) {
        const horarios = await this.horarioRepo.find({
          where: { sucursal: { negocio: { id: n.id } }, diaSemana: dia },
          relations: ['sucursal', 'sucursal.negocio'],
        });

        const abierto = horarios.some(
          (h) => horaActual >= h.horaApertura && horaActual <= h.horaCierre,
        );

        if (abierto) abiertos.push(n);
      }

      negocios = abiertos;
    }

    // 🔹 4. Filtro: promociones activas
    if (promocionesActivas) {
      const negociosConPromo: (Negocio & { promociones: PromocionSucursal[] })[] = [];

      for (const n of negocios) {
        const promos = await this.promoRepo.find({
          where: {
            sucursal: { negocio: { id: n.id } },
            activa: true,
          },
          relations: ['sucursal', 'sucursal.negocio'],
        });

        if (promos.length > 0) {
          negociosConPromo.push({
            ...n,
            promociones: promos,
          });
        }
      }

      negocios = negociosConPromo;
    }

    // 🔹 5. Filtro: cercanos (si se proporciona latitud/longitud)
    if (latitud && longitud) {
      const toRad = (value: number) => (value * Math.PI) / 180;

      negocios = negocios
        .map((negocio) => {
          const sucursalPrincipal = negocio.sucursales?.[0];

          if (sucursalPrincipal?.latitud && sucursalPrincipal?.longitud) {
            const lat1 = latitud;
            const lon1 = longitud;
            const lat2 = Number(sucursalPrincipal.latitud);
            const lon2 = Number(sucursalPrincipal.longitud);

            // Fórmula de Haversine
            const R = 6371; // km
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distancia = R * c;

            return {
              ...negocio,
              distanciaKm: parseFloat(distancia.toFixed(2)),
              sucursalCercana: sucursalPrincipal.nombreSucursal,
            };
          }

          return { ...negocio, distanciaKm: null };
        })
        .filter((n) => n.distanciaKm !== null)
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, 10); // máximo 10 resultados
    }

    // 🔹 6. Resultado final
    return negocios;
  }
}
