import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { CaracteristicaAplicabilidad } from './entities/caracteristicas-aplicabilidad.entity';
import { CreateCaracteristicaDto } from './dtos/create-caracteristica.dto';
import { UpdateCaracteristicaDto } from './dtos/update-caracteristica.dto';

@Injectable()
export class CaracteristicasSucursalService {
  constructor(
    @InjectRepository(CaracteristicaSucursal)
    private readonly repo: Repository<CaracteristicaSucursal>,

    @InjectRepository(CaracteristicaAplicabilidad)
    private readonly aplicabilidadRepo: Repository<CaracteristicaAplicabilidad>,
  ) {}

  async create(dto: CreateCaracteristicaDto) {
    const existe = await this.repo.findOne({
      where: { codigo: dto.codigo },
    });

    if (existe) {
      throw new BadRequestException(
        'Ya existe una característica con ese código',
      );
    }

    const { aplicabilidades = [], ...caracteristicaData } = dto;

    const nueva = this.repo.create({
      ...caracteristicaData,
      activo: caracteristicaData.activo ?? true,
    });

    const guardada = await this.repo.save(nueva);

    if (aplicabilidades.length > 0) {
      const nuevasAplicabilidades = aplicabilidades.map((a) =>
        this.aplicabilidadRepo.create({
          caracteristicaId: guardada.id,
          nivel: a.nivel,
          referenciaId: a.nivel === 'todos' ? null : (a.referenciaId ?? null),
          activo: true,
        }),
      );

      await this.aplicabilidadRepo.save(nuevasAplicabilidades);
    }

    return this.repo.findOne({
      where: { id: guardada.id },
      relations: ['aplicabilidades'],
    });
  }

  findAll() {
    return this.repo.find({
      relations: ['aplicabilidades'],
      order: {
        id: 'DESC',
      },
    });
  }

  findByCodigo(codigo: string) {
    return this.repo.findOne({
      where: { codigo },
      relations: ['aplicabilidades'],
    });
  }

  async findOne(id: number) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades'],
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    return existente;
  }

  async update(id: number, dto: UpdateCaracteristicaDto) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades'],
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    if (dto.codigo && dto.codigo !== existente.codigo) {
      const codigoDuplicado = await this.repo.findOne({
        where: { codigo: dto.codigo },
      });

      if (codigoDuplicado) {
        throw new BadRequestException(
          'Ya existe una característica con ese código',
        );
      }
    }

    const { aplicabilidades, ...caracteristicaData } = dto;

    Object.assign(existente, caracteristicaData);
    await this.repo.save(existente);

    if (aplicabilidades) {
      await this.aplicabilidadRepo.delete({ caracteristicaId: id });

      if (aplicabilidades.length > 0) {
        const nuevasAplicabilidades = aplicabilidades.map((a) =>
          this.aplicabilidadRepo.create({
            caracteristicaId: id,
            nivel: a.nivel,
            referenciaId: a.nivel === 'todos' ? null : (a.referenciaId ?? null),
            activo: true,
          }),
        );

        await this.aplicabilidadRepo.save(nuevasAplicabilidades);
      }
    }

    return this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades'],
    });
  }

  async remove(id: number) {
    const existente = await this.repo.findOne({
      where: { id },
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    await this.aplicabilidadRepo.delete({ caracteristicaId: id });
    await this.repo.delete(id);

    return { message: 'Característica eliminada' };
  }

  async findAplicables(params: {
    categoriaId?: number;
    subcategoriaId?: number;
    especialidadId?: number;
    tipoServicioId?: number;
  }) {
    const {
      categoriaId,
      subcategoriaId,
      especialidadId,
      tipoServicioId,
    } = params;

    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.aplicabilidades', 'a')
      .where('c.activo = 1')
      .andWhere(
        `
        (
          (a.nivel = 'todos' AND a.activo = 1)
          OR (a.nivel = 'categoria' AND a.referenciaId = :categoriaId AND a.activo = 1)
          OR (a.nivel = 'subcategoria' AND a.referenciaId = :subcategoriaId AND a.activo = 1)
          OR (a.nivel = 'especialidad' AND a.referenciaId = :especialidadId AND a.activo = 1)
          OR (a.nivel = 'tipo_servicio' AND a.referenciaId = :tipoServicioId AND a.activo = 1)
        )
        `,
        {
          categoriaId: categoriaId ?? null,
          subcategoriaId: subcategoriaId ?? null,
          especialidadId: especialidadId ?? null,
          tipoServicioId: tipoServicioId ?? null,
        },
      )
      .orderBy('c.nombre', 'ASC');

    return qb.getMany();
  }
}