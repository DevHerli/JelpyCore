import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CaracteristicaAlias } from './entities/caracteristica-alias.entity';
import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { CreateCaracteristicaAliasDto } from './dtos/create-caracteristica-alias.dto';
import { UpdateCaracteristicaAliasDto } from './dtos/update-caracteristica-alias.dto';

@Injectable()
export class CaracteristicasAliasesService {
  constructor(
    @InjectRepository(CaracteristicaAlias)
    private readonly aliasRepo: Repository<CaracteristicaAlias>,

    @InjectRepository(CaracteristicaSucursal)
    private readonly caracteristicaRepo: Repository<CaracteristicaSucursal>,
  ) {}

  async create(dto: CreateCaracteristicaAliasDto) {
    const caracteristica = await this.caracteristicaRepo.findOne({
      where: { id: dto.caracteristicaId, activo: true },
    });

    if (!caracteristica) {
      throw new NotFoundException('Característica no encontrada o inactiva');
    }

    const aliasLimpio = dto.alias.trim();

    const existe = await this.aliasRepo.findOne({
      where: {
        caracteristicaId: dto.caracteristicaId,
        alias: aliasLimpio,
      },
    });

    if (existe) {
      throw new BadRequestException(
        'Ya existe ese alias para esta característica',
      );
    }

    const nuevo = this.aliasRepo.create({
      caracteristicaId: dto.caracteristicaId,
      alias: aliasLimpio,
      activo: dto.activo ?? true,
    });

    const guardado = await this.aliasRepo.save(nuevo);

    return this.findOne(Number(guardado.id));
  }

  findAll() {
    return this.aliasRepo.find({
      relations: ['caracteristica'],
      order: { id: 'DESC' },
    });
  }

  async findByCaracteristica(caracteristicaId: number) {
    const caracteristica = await this.caracteristicaRepo.findOne({
      where: { id: caracteristicaId },
    });

    if (!caracteristica) {
      throw new NotFoundException('Característica no encontrada');
    }

    return this.aliasRepo.find({
      where: { caracteristicaId },
      relations: ['caracteristica'],
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const alias = await this.aliasRepo.findOne({
      where: { id },
      relations: ['caracteristica'],
    });

    if (!alias) {
      throw new NotFoundException('Alias no encontrado');
    }

    return alias;
  }

  async update(id: number, dto: UpdateCaracteristicaAliasDto) {
    const alias = await this.aliasRepo.findOne({
      where: { id },
    });

    if (!alias) {
      throw new NotFoundException('Alias no encontrado');
    }

    if (dto.alias !== undefined) {
      const aliasLimpio = dto.alias.trim();

      const duplicado = await this.aliasRepo.findOne({
        where: {
          caracteristicaId: alias.caracteristicaId,
          alias: aliasLimpio,
        },
      });

      if (duplicado && Number(duplicado.id) !== Number(id)) {
        throw new BadRequestException(
          'Ya existe ese alias para esta característica',
        );
      }

      alias.alias = aliasLimpio;
    }

    if (dto.activo !== undefined) {
      alias.activo = dto.activo;
    }

    await this.aliasRepo.save(alias);

    return this.findOne(id);
  }

  async remove(id: number) {
    const alias = await this.aliasRepo.findOne({
      where: { id },
    });

    if (!alias) {
      throw new NotFoundException('Alias no encontrado');
    }

    await this.aliasRepo.delete(id);

    return {
      message: 'Alias eliminado correctamente',
    };
  }
}