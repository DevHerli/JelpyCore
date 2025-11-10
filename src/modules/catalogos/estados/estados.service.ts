import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Estado } from './entities/estado.entity';
import { CreateEstadoDto } from './dto/create-estado.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';

@Injectable()
export class EstadosService {
  constructor(
    @InjectRepository(Estado)
    private readonly estadosRepo: Repository<Estado>,
  ) {}

  async create(dto: CreateEstadoDto): Promise<Estado> {
    const estado = this.estadosRepo.create(dto);
    return await this.estadosRepo.save(estado);
  }

  async findAll(): Promise<Estado[]> {
    return await this.estadosRepo.find({ where: { activo: true } });
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
    return await this.estadosRepo.save(estado);
  }

  async softDelete(id: number, eliminadoPor?: number) {
    const estado = await this.estadosRepo.findOne({ where: { id } });
    if (!estado) throw new NotFoundException('Estado no encontrado');

    estado.activo = false;
    estado.eliminadoPor = eliminadoPor ?? null;
    return await this.estadosRepo.save(estado);
  }
}
