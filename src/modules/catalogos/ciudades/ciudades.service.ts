import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Ciudad } from './entities/ciudades.entity';
import { CreateCiudadDto } from './dtos/create-ciudad.dto';
import { UpdateCiudadDto } from './dtos/update-ciudad.dto';

@Injectable()
export class CiudadesService {
  constructor(
    @InjectRepository(Ciudad)
    private readonly ciudadRepo: Repository<Ciudad>,
  ) {}

  async listar(): Promise<Ciudad[]> {
    return await this.ciudadRepo.find({
      order: { id: 'DESC' },
    });
  }

  async obtenerPorId(id: number): Promise<Ciudad> {
    const ciudad = await this.ciudadRepo.findOne({ where: { id } });
    if (!ciudad) {
      throw new NotFoundException(`No se encontró la ciudad con id ${id}`);
    }
    return ciudad;
  }

  async crear(data: CreateCiudadDto): Promise<Ciudad> {
    const nueva = this.ciudadRepo.create(data);
    return await this.ciudadRepo.save(nueva);
  }

  async actualizar(id: number, data: UpdateCiudadDto): Promise<Ciudad> {
    const ciudad = await this.ciudadRepo.findOne({ where: { id } });
    if (!ciudad) {
      throw new NotFoundException(`No se encontró la ciudad con id ${id}`);
    }

    Object.assign(ciudad, data);
    return await this.ciudadRepo.save(ciudad);
  }

  async eliminar(id: number): Promise<{ message: string }> {
    const ciudad = await this.ciudadRepo.findOne({ where: { id } });
    if (!ciudad) {
      throw new NotFoundException(`No se encontró la ciudad con id ${id}`);
    }
    await this.ciudadRepo.remove(ciudad);
    return { message: 'Ciudad eliminada correctamente' };
  }

  async buscarPorNombre(nombre: string): Promise<Ciudad[]> {
    return this.ciudadRepo.find({
      where: { nombre: Like(`%${nombre}%`) },
    });
  }
}
