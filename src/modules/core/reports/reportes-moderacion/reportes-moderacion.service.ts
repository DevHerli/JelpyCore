import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReporteModeracion } from './entities/reporte-moderacion.entity';

@Injectable()
export class ReportesModeracionService {
  constructor(
    @InjectRepository(ReporteModeracion)
    private readonly repo: Repository<ReporteModeracion>,
  ) {}

  async crear(data: Partial<ReporteModeracion>): Promise<ReporteModeracion> {
    const nuevo = this.repo.create(data);
    return this.repo.save(nuevo);
  }

  async listar(): Promise<ReporteModeracion[]> {
    return this.repo.find({
      relations: ['suscriptor'],
      order: { fechaRegistro: 'DESC' },
    });
  }

  async marcarComoAtendido(id: number, observaciones?: string) {
    await this.repo.update(id, {
      atendido: true,
      observaciones: observaciones || null,
    });
    return this.repo.findOne({ where: { id } });
  }
}
