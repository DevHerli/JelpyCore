import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { EstadisticaSucursalHistorico } from './entities/estadistica-sucursal-historico.entity';
import { CreateEstadisticaSucursalDto } from './dto/create-estadistica-sucursal.dto';

// JLP-M24: contexto del solicitante para verificar propiedad.
export type RequesterCtx = { sub: number; isAdmin: boolean };

@Injectable()
export class EstadisticasSucursalesHistoricoService {
  constructor(
    @InjectRepository(EstadisticaSucursalHistorico)
    private readonly estRepo: Repository<EstadisticaSucursalHistorico>,
  ) {}

  // JLP-M24: dueño del negocio (o admin).
  private async assertOwnershipNegocio(
    negocioId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester || requester.isAdmin) return;
    const rows = await this.estRepo.manager.query(
      `SELECT suscriptor_id FROM negocios WHERE id = ? LIMIT 1`,
      [negocioId],
    );
    if (!rows.length) throw new NotFoundException('Negocio no encontrado');
    if (Number(rows[0].suscriptor_id) !== requester.sub) {
      throw new ForbiddenException('No tienes permiso sobre este negocio');
    }
  }

  // JLP-M24: dueño de la sucursal vía negocio (o admin).
  private async assertOwnershipSucursal(
    sucursalId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester || requester.isAdmin) return;
    const rows = await this.estRepo.manager.query(
      `SELECT n.suscriptor_id AS suscriptor_id
         FROM sucursales_negocios s
         JOIN negocios n ON n.id = s.negocio_id
        WHERE s.id = ? LIMIT 1`,
      [sucursalId],
    );
    if (!rows.length) throw new NotFoundException('Sucursal no encontrada');
    if (Number(rows[0].suscriptor_id) !== requester.sub) {
      throw new ForbiddenException('No tienes permiso sobre esta sucursal');
    }
  }

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

  async obtenerPorSucursal(sucursalId: number, requester?: RequesterCtx) {
    await this.assertOwnershipSucursal(sucursalId, requester);
    return this.estRepo.find({
      where: { sucursal: { id: sucursalId } },
      order: { fecha: 'DESC' },
    });
  }

  async obtenerPorNegocio(
    negocioId: number,
    fechaInicio?: string,
    fechaFin?: string,
    requester?: RequesterCtx,
  ) {
    await this.assertOwnershipNegocio(negocioId, requester);
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
