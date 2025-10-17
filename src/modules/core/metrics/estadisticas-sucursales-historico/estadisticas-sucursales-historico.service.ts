import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { EstadisticaSucursalHistorico } from './entities/estadistica-sucursal-historico.entity';
import { CreateEstadisticaSucursalDto } from './dto/create-estadistica-sucursal.dto';

@Injectable()
export class EstadisticasSucursalesHistoricoService {
  constructor(
    @InjectRepository(EstadisticaSucursalHistorico)
    private readonly estRepo: Repository<EstadisticaSucursalHistorico>,
  ) {}

  async registrar(dto: CreateEstadisticaSucursalDto) {
    const nueva = this.estRepo.create({
      sucursal: { id: dto.sucursalId } as any,
      negocio: { id: dto.negocioId } as any,
      ciudad: dto.ciudadId ? ({ id: dto.ciudadId } as any) : null,
      vistas: dto.vistas ?? 0,
      clics: dto.clics ?? 0,
      busquedas: dto.busquedas ?? 0,
      fecha: dto.fecha ?? new Date().toISOString().split('T')[0],
    });

    return this.estRepo.save(nueva);
  }

  async obtenerPorSucursal(sucursalId: number) {
    return this.estRepo.find({
      where: { sucursal: { id: sucursalId } },
      order: { fecha: 'DESC' },
    });
  }

  async obtenerPorNegocio(negocioId: number, fechaInicio?: string, fechaFin?: string) {
    const where: any = { negocio: { id: negocioId } };
    if (fechaInicio && fechaFin)
      where.fecha = Between(fechaInicio, fechaFin);

    return this.estRepo.find({
      where,
      order: { fecha: 'DESC' },
    });
  }

  async obtenerTotalesPorCiudad(ciudadId: number) {
    return this.estRepo
      .createQueryBuilder('e')
      .select('e.ciudad_id', 'ciudadId')
      .addSelect('SUM(e.vistas)', 'totalVistas')
      .addSelect('SUM(e.clics)', 'totalClics')
      .addSelect('SUM(e.busquedas)', 'totalBusquedas')
      .where('e.ciudad_id = :ciudadId', { ciudadId })
      .groupBy('e.ciudad_id')
      .getRawOne();
  }


// 🏆 🔹 TOP SUCURSALES MÁS VISTAS O CLICKEADAS
async obtenerTopSucursales(filtros: {
  negocioId?: number;
  ciudadId?: number;
  fechaInicio?: string;
  fechaFin?: string;
  tipo?: 'vistas' | 'clics';
  limite?: number;
}) {
  const {
    negocioId,
    ciudadId,
    fechaInicio,
    fechaFin,
    tipo = 'vistas',
    limite = 5,
  } = filtros;

  let where = `WHERE 1=1 `;
  if (negocioId) where += `AND esh.negocio_id = ${negocioId} `;
  if (ciudadId) where += `AND esh.ciudad_id = ${ciudadId} `;
  if (fechaInicio && fechaFin)
    where += `AND esh.fecha BETWEEN '${fechaInicio}' AND '${fechaFin}' `;

  const query = `
    SELECT 
      sn.id AS sucursal_id,
      sn.nombre_sucursal,
      sn.calle,
      sn.colonia,
      sn.codigo_postal,
      c.nombre AS ciudad,
      n.nombre_negocio AS negocio,
      SUM(esh.vistas) AS total_vistas,
      SUM(esh.clics) AS total_clics
    FROM estadisticas_sucursales_historico esh
    INNER JOIN sucursales_negocios sn ON sn.id = esh.sucursal_id
    INNER JOIN negocios n ON n.id = esh.negocio_id
    LEFT JOIN ciudades c ON c.id = esh.ciudad_id
    ${where}
    GROUP BY sn.id, sn.nombre_sucursal, sn.calle, sn.colonia, sn.codigo_postal, c.nombre, n.nombre_negocio
    ORDER BY ${tipo === 'clics' ? 'total_clics' : 'total_vistas'} DESC
    LIMIT ${limite};
  `;

  return this.estRepo.query(query);
}




}
