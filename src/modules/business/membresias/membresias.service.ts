import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membresia } from './entities/membresia.entity';
import { CreateMembresiaDto } from './dto/create-membresia.dto';
import { UpdateMembresiaDto } from './dto/update-membresia.dto';

@Injectable()
export class MembresiasService {
  constructor(
    @InjectRepository(Membresia)
    private readonly membresiaRepo: Repository<Membresia>,
  ) {}

  async listar(): Promise<Membresia[]> {
    return this.membresiaRepo.find({ where: { activo: true }, order: { nombre: 'ASC' } });
  }

  async obtenerPorId(id: number): Promise<Membresia> {
    const membresia = await this.membresiaRepo.findOne({ where: { id } });
    if (!membresia) throw new NotFoundException('Membresía no encontrada');
    return membresia;
  }

  async crear(dto: CreateMembresiaDto): Promise<Membresia> {
    const nueva = this.membresiaRepo.create(dto);
    return this.membresiaRepo.save(nueva);
  }

  async actualizar(id: number, dto: UpdateMembresiaDto): Promise<Membresia> {
    const membresia = await this.obtenerPorId(id);
    Object.assign(membresia, dto);
    return this.membresiaRepo.save(membresia);
  }

  async eliminar(id: number): Promise<void> {
    const membresia = await this.obtenerPorId(id);
    await this.membresiaRepo.remove(membresia);
  }
}
