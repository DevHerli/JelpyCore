import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadisticaHistorico } from './entities/estadistica-historico.entity';
import { CreateEstadisticaHistoricoDto } from './dto/create-estadistica-historico.dto';

@Injectable()
export class EstadisticaHistoricoService {
  constructor(
    @InjectRepository(EstadisticaHistorico)
    private readonly repo: Repository<EstadisticaHistorico>,
  ) {}

  async registrar(dto: CreateEstadisticaHistoricoDto) {
    const registro = this.repo.create({
      ...dto,
      negocio: { id: dto.negocioId } as any,
      ciudad: { id: dto.ciudadId } as any,
      membresia: dto.membresiaId ? { id: dto.membresiaId } as any : null,
    });
    return this.repo.save(registro);
  }

  async listarPorRango(fechaInicio: string, fechaFin: string, ciudadId?: number) {
    const where = `
      WHERE fecha BETWEEN '${fechaInicio}' AND '${fechaFin}'
      ${ciudadId ? `AND ciudad_id = ${ciudadId}` : ''}
    `;

    return this.repo.query(`
      SELECT 
        fecha,
        SUM(vistas) AS totalVistas,
        SUM(clics) AS totalClics,
        SUM(busquedas) AS totalBusquedas
      FROM estadisticas_historico
      ${where}
      GROUP BY fecha
      ORDER BY fecha ASC
    `);
  }
}
