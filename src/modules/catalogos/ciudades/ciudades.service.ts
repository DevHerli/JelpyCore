import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ciudad } from './entities/ciudades.entity';

@Injectable()
export class CiudadesService {
  constructor(
    @InjectRepository(Ciudad)
    private readonly ciudadRepo: Repository<Ciudad>,
  ) {}

  async listar(): Promise<Ciudad[]> {
    return this.ciudadRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async obtenerPorId(id: number): Promise<Ciudad> {
    const ciudad = await this.ciudadRepo.findOne({ where: { id, activo: true } });
    if (!ciudad) throw new NotFoundException('Ciudad no encontrada');
    return ciudad;
  }

  async crear(data: Partial<Ciudad>): Promise<Ciudad> {
    const nueva = this.ciudadRepo.create(data);
    return this.ciudadRepo.save(nueva);
  }

  async actualizar(id: number, data: Partial<Ciudad>): Promise<Ciudad> {
    const ciudad = await this.obtenerPorId(id);
    Object.assign(ciudad, data);
    return this.ciudadRepo.save(ciudad);
  }

  async eliminar(id: number): Promise<void> {
    const ciudad = await this.obtenerPorId(id);
    ciudad.activo = false;
    await this.ciudadRepo.save(ciudad);
  }
}
