import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { CreateCaracteristicaDto } from './dtos/create-caracteristica.dto';
import { UpdateCaracteristicaDto } from './dtos/update-caracteristica.dto';

@Injectable()
export class CaracteristicasSucursalService {
  constructor(
    @InjectRepository(CaracteristicaSucursal)
    private repo: Repository<CaracteristicaSucursal>,
  ) {}

  create(dto: CreateCaracteristicaDto) {
    const nueva = this.repo.create(dto);
    return this.repo.save(nueva);
  }

  findAll() {
    return this.repo.find();
  }

  findByCodigo(codigo: string) {
    return this.repo.findOne({ where: { codigo } });
  }

  async update(id: number, dto: UpdateCaracteristicaDto) {
    const existente = await this.repo.findOne({ where: { id } });

    if (!existente) throw new NotFoundException('No encontrada');

    Object.assign(existente, dto);
    return this.repo.save(existente);
  }

  async remove(id: number) {
    await this.repo.delete(id);
    return { message: 'Característica eliminada' };
  }
}
