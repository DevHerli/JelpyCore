import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { EstadisticaResumenSemanal } from './entities/estadistica-resumen-semanal.entity';

@Injectable()
export class EstadisticasSemanalesService {
  constructor(
    @InjectRepository(EstadisticaResumenSemanal)
    private readonly resumenRepo: Repository<EstadisticaResumenSemanal>,
  ) {}

  async obtenerResumen(filtros: {
    ciudadId?: number;
    membresiaId?: number;
    fechaInicio?: string;
    fechaFin?: string;
  }) {
    const where: any = {};

    if (filtros.ciudadId) where.ciudad = { id: filtros.ciudadId };
    if (filtros.membresiaId) where.membresia = { id: filtros.membresiaId };
    if (filtros.fechaInicio && filtros.fechaFin)
      where.semanaInicio = Between(filtros.fechaInicio, filtros.fechaFin);

    // Usamos QueryBuilder para permitir order por relación (ciudad.nombre)
    const query = this.resumenRepo
      .createQueryBuilder('resumen')
      .leftJoinAndSelect('resumen.ciudad', 'ciudad')
      .leftJoinAndSelect('resumen.membresia', 'membresia')
      .where(where)
      .orderBy('resumen.semanaInicio', 'DESC')
      .addOrderBy('ciudad.nombre', 'ASC');

    return await query.getMany();
  }

  async obtenerUltimasSemanas(limite = 5) {
    return this.resumenRepo.find({
      order: { semanaInicio: 'DESC' },
      take: limite,
    });
  }

  async obtenerTopNegocios(filtros: {
    ciudadId?: number;
    membresiaId?: number;
    fechaInicio?: string;
    fechaFin?: string;
    limite?: number;
    tipo?: 'vistas' | 'clics';
  }) {
    const { ciudadId, membresiaId, fechaInicio, fechaFin, limite = 5, tipo = 'vistas' } = filtros;

    // JLP-SEC: antes las fechas se concatenaban crudas en el SQL
    // (`fecha BETWEEN '${fechaInicio}' AND '${fechaFin}'`), lo que permitía
    // inyección SQL vía querystring. Probado con una comilla simple contra
    // producción: rompía la sintaxis (errno 1064). ciudadId/membresiaId/limite
    // ya llegan como Number() desde el controller y no eran inyectables, pero
    // se parametrizan también por consistencia y para no depender de esa
    // coerción previa como única defensa.
    const where: string[] = ['1=1'];
    const params: (string | number)[] = [];
    if (ciudadId) { where.push('eh.ciudad_id = ?'); params.push(ciudadId); }
    if (membresiaId) { where.push('eh.membresia_id = ?'); params.push(membresiaId); }
    if (fechaInicio && fechaFin) {
      where.push('eh.fecha BETWEEN ? AND ?');
      params.push(fechaInicio, fechaFin);
    }
    const limiteSeguro = Number.isFinite(Number(limite)) ? Number(limite) : 5;
    params.push(limiteSeguro);

    const query = `
      SELECT
        n.id AS negocio_id,
        n.nombre_negocio,
        n.logo_url,
        c.nombre AS ciudad,
        m.nombre AS membresia,
        SUM(eh.vistas) AS total_vistas,
        SUM(eh.clics) AS total_clics
      FROM estadisticas_historico eh
      INNER JOIN negocios n ON n.id = eh.negocio_id
      LEFT JOIN ciudades c ON c.id = eh.ciudad_id
      LEFT JOIN membresias m ON m.id = eh.membresia_id
      WHERE ${where.join(' AND ')}
      GROUP BY n.id, n.nombre_negocio, c.nombre, m.nombre
      ORDER BY ${tipo === 'clics' ? 'total_clics' : 'total_vistas'} DESC
      LIMIT ?;
    `;

    return this.resumenRepo.query(query, params);
  }

  async obtenerTopSucursales(filtros: {
    negocioId?: number;
    ciudadId?: number;
    fechaInicio?: string;
    fechaFin?: string;
    tipo?: 'vistas' | 'clics';
    limite?: number;
  }) {
    const { negocioId, ciudadId, fechaInicio, fechaFin, tipo = 'vistas', limite = 5 } = filtros;

    // JLP-SEC: mismo fix que obtenerTopNegocios — fechas parametrizadas.
    const where: string[] = ['1=1'];
    const params: (string | number)[] = [];
    if (negocioId) { where.push('esh.negocio_id = ?'); params.push(negocioId); }
    if (ciudadId) { where.push('esh.ciudad_id = ?'); params.push(ciudadId); }
    if (fechaInicio && fechaFin) {
      where.push('esh.fecha BETWEEN ? AND ?');
      params.push(fechaInicio, fechaFin);
    }
    const limiteSeguro = Number.isFinite(Number(limite)) ? Number(limite) : 5;
    params.push(limiteSeguro);

    const query = `
      SELECT
        sn.id AS sucursal_id,
        sn.nombre_sucursal,
        sn.calle,
        sn.colonia,
        sn.codigo_postal,
        SUM(esh.vistas) AS total_vistas,
        SUM(esh.clics) AS total_clics
      FROM estadisticas_sucursales_historico esh
      INNER JOIN sucursales_negocios sn ON sn.id = esh.sucursal_id
      WHERE ${where.join(' AND ')}
      GROUP BY sn.id, sn.nombre_sucursal, sn.calle, sn.colonia, sn.codigo_postal
      ORDER BY ${tipo === 'clics' ? 'total_clics' : 'total_vistas'} DESC
      LIMIT ?;
    `;

    return this.resumenRepo.query(query, params);
  }
}
