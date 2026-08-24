import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Ciudad } from './entities/ciudades.entity';
import { CreateCiudadDto } from './dtos/create-ciudad.dto';
import { UpdateCiudadDto } from './dtos/update-ciudad.dto';
import { MemoryCacheService } from '../../../common/cache/memory-cache.service';

// Prefijo de claves de caché de este catálogo (para invalidación por familia).
const CACHE_PREFIX = 'ciudades:';

@Injectable()
export class CiudadesService {
  constructor(
    @InjectRepository(Ciudad)
    private readonly ciudadRepo: Repository<Ciudad>,

    private readonly cache: MemoryCacheService,
  ) {}

  async listar(): Promise<Ciudad[]> {
    return this.cache.wrap(`${CACHE_PREFIX}listar`, () =>
      this.ciudadRepo.find({
        order: { id: 'DESC' },
      }),
    );
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
    const guardada = await this.ciudadRepo.save(nueva);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardada;
  }

  async actualizar(id: number, data: UpdateCiudadDto): Promise<Ciudad> {
    const ciudad = await this.ciudadRepo.findOne({ where: { id } });
    if (!ciudad) {
      throw new NotFoundException(`No se encontró la ciudad con id ${id}`);
    }

    Object.assign(ciudad, data);
    const guardada = await this.ciudadRepo.save(ciudad);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardada;
  }

  async eliminar(id: number): Promise<{ message: string }> {
    const ciudad = await this.ciudadRepo.findOne({ where: { id } });
    if (!ciudad) {
      throw new NotFoundException(`No se encontró la ciudad con id ${id}`);
    }
    await this.ciudadRepo.remove(ciudad);
    this.cache.delByPrefix(CACHE_PREFIX);
    return { message: 'Ciudad eliminada correctamente' };
  }

  async buscarPorNombre(nombre: string): Promise<Ciudad[]> {
    return this.ciudadRepo.find({
      where: { nombre: Like(`%${nombre}%`) },
    });
  }
}
