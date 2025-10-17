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
    private readonly estadoRepo: Repository<Estado>,
  ) {}

  async listar(): Promise<Estado[]> {
    return this.estadoRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async obtenerPorId(id: number): Promise<Estado> {
    const estado = await this.estadoRepo.findOne({ where: { id } });
    if (!estado) throw new NotFoundException('Estado no encontrado');
    return estado;
  }

  async crear(dto: CreateEstadoDto): Promise<Estado> {
    const nuevo = this.estadoRepo.create(dto);
    return this.estadoRepo.save(nuevo);
  }

  async actualizar(id: number, dto: UpdateEstadoDto): Promise<Estado> {
    const estado = await this.obtenerPorId(id);
    Object.assign(estado, dto);
    return this.estadoRepo.save(estado);
  }

  async eliminar(id: number): Promise<void> {
    const estado = await this.obtenerPorId(id);
    estado.activo = false;
    await this.estadoRepo.save(estado);
  }
}
