import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Estado } from './entities/estado.entity';
import { CreateEstadoDto } from './dto/create-estado.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { MemoryCacheService } from '../../../common/cache/memory-cache.service';

// Prefijo de claves de caché de este catálogo (para invalidación por familia).
const CACHE_PREFIX = 'estados:';

@Injectable()
export class EstadosService {
  constructor(
    @InjectRepository(Estado)
    private readonly estadosRepo: Repository<Estado>,

    private readonly cache: MemoryCacheService,
  ) {}

  async create(dto: CreateEstadoDto): Promise<Estado> {
    const estado = this.estadosRepo.create(dto);
    const guardado = await this.estadosRepo.save(estado);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardado;
  }

  async findAll(): Promise<Estado[]> {
    return this.cache.wrap(`${CACHE_PREFIX}findAll`, () =>
      this.estadosRepo.find({ where: { activo: true } }),
    );
  }

  async findOne(id: number): Promise<Estado> {
    const estado = await this.estadosRepo.findOne({ where: { id } });
    if (!estado) throw new NotFoundException('Estado no encontrado');
    return estado;
  }

  async update(id: number, dto: UpdateEstadoDto): Promise<Estado> {
    const estado = await this.estadosRepo.findOne({ where: { id } });
    if (!estado) throw new NotFoundException('Estado no encontrado');

    Object.assign(estado, dto);
    const guardado = await this.estadosRepo.save(estado);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardado;
  }

  async softDelete(id: number, eliminadoPor?: number) {
    const estado = await this.estadosRepo.findOne({ where: { id } });
    if (!estado) throw new NotFoundException('Estado no encontrado');

    estado.activo = false;
    estado.eliminadoPor = eliminadoPor ?? null;
    const guardado = await this.estadosRepo.save(estado);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardado;
  }
}
