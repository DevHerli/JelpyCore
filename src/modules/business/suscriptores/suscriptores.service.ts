import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Suscriptor } from './entities/suscriptores.entity';
import { CreateSuscriptorDto } from './dto/create-suscriptor.dto';
import { UpdateSuscriptorDto } from './dto/update-suscriptor.dto';

@Injectable()
export class SuscriptoresService {
  constructor(
    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
  ) {}

  async listar(): Promise<Suscriptor[]> {
    return this.suscriptorRepo.find({
      where: { eliminado: false },
      order: { nombre: 'ASC' },
    });
  }

  async obtenerPorId(id: number): Promise<Suscriptor> {
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id, eliminado: false },
    });
    if (!suscriptor) throw new NotFoundException('Suscriptor no encontrado');
    return suscriptor;
  }

async crear(dto: CreateSuscriptorDto): Promise<Suscriptor> {
  const nuevo = this.suscriptorRepo.create({
    ...dto,
    ciudad: { id: dto.ciudadId } as any, // relación con ciudades
    estado: dto.estadoId ? ({ id: dto.estadoId } as any) : null, // relación con estados
  });

  return this.suscriptorRepo.save(nuevo);
}

  async actualizar(id: number, dto: UpdateSuscriptorDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);
    Object.assign(suscriptor, dto);
    return this.suscriptorRepo.save(suscriptor);
  }

  async eliminar(id: number): Promise<void> {
    const suscriptor = await this.obtenerPorId(id);
    suscriptor.eliminado = true;
    await this.suscriptorRepo.save(suscriptor);
  }
}
