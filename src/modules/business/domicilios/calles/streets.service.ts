import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Street } from './entities/street.entity';
import { StreetColony } from './entities/street-colony.entity';
import { Colonia } from '../colonias/entities/colonia.entity';

import { CreateStreetDto } from './dtos/create-street.dto';
import { UpdateStreetDto } from './dtos/update-street.dto';
import { CreateStreetColonyDto } from './dtos/create-street-colony.dto';
import { UpdateStreetColonyDto } from './dtos/update-street-colony.dto';

@Injectable()
export class StreetsService {
  constructor(
    @InjectRepository(Street)
    private readonly streetRepository: Repository<Street>,

    @InjectRepository(StreetColony)
    private readonly streetColonyRepository: Repository<StreetColony>,

    @InjectRepository(Colonia)
    private readonly coloniaRepository: Repository<Colonia>,
  ) {}

  private normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  async create(createStreetDto: CreateStreetDto): Promise<Street> {
    const nombreNormalizado =
      createStreetDto.nombre_normalizado?.trim() ||
      this.normalizeText(createStreetDto.nombre);

    const existingStreet = await this.streetRepository.findOne({
      where: {
        nombre_normalizado: nombreNormalizado,
      },
    });

    if (existingStreet) {
      throw new BadRequestException(
        `Ya existe una calle con el nombre ${createStreetDto.nombre}.`,
      );
    }

    const street = this.streetRepository.create({
      nombre: createStreetDto.nombre.trim(),
      nombre_normalizado: nombreNormalizado,
      tipo_vialidad: createStreetDto.tipo_vialidad ?? null,
      activo: createStreetDto.activo !== undefined ? createStreetDto.activo : true,
      creado_por: createStreetDto.creado_por ?? null,
    });

    return await this.streetRepository.save(street);
  }

  async findAll(filters?: {
    nombre?: string;
    tipo_vialidad?: string;
    activo?: string;
  }): Promise<Street[]> {
    const query = this.streetRepository.createQueryBuilder('street');

    if (filters?.nombre) {
      query.andWhere(
        '(street.nombre LIKE :nombre OR street.nombre_normalizado LIKE :nombreNormalizado)',
        {
          nombre: `%${filters.nombre}%`,
          nombreNormalizado: `%${this.normalizeText(filters.nombre)}%`,
        },
      );
    }

    if (filters?.tipo_vialidad) {
      query.andWhere('street.tipo_vialidad = :tipo_vialidad', {
        tipo_vialidad: filters.tipo_vialidad,
      });
    }

    if (filters?.activo !== undefined) {
      query.andWhere('street.activo = :activo', {
        activo: Number(filters.activo),
      });
    }

    query.orderBy('street.nombre', 'ASC');

    return await query.getMany();
  }

  async findOne(id: string): Promise<Street> {
    const street = await this.streetRepository.findOne({
      where: { id: id as any },
    });

    if (!street) {
      throw new NotFoundException(`Calle con id ${id} no encontrada.`);
    }

    return street;
  }

  async update(id: string, updateStreetDto: UpdateStreetDto): Promise<Street> {
    const street = await this.findOne(id);

    let nombreNormalizadoFinal = street.nombre_normalizado;

    if (updateStreetDto.nombre !== undefined) {
      nombreNormalizadoFinal =
        updateStreetDto.nombre_normalizado?.trim() ||
        this.normalizeText(updateStreetDto.nombre);
    } else if (updateStreetDto.nombre_normalizado !== undefined) {
      nombreNormalizadoFinal = updateStreetDto.nombre_normalizado.trim();
    }

    const duplicate = await this.streetRepository
      .createQueryBuilder('street')
      .where('street.nombre_normalizado = :nombreNormalizadoFinal', {
        nombreNormalizadoFinal,
      })
      .andWhere('street.id != :id', { id })
      .getOne();

    if (duplicate) {
      throw new BadRequestException(
        `Ya existe una calle con ese nombre normalizado.`,
      );
    }

    Object.assign(street, {
      ...updateStreetDto,
      nombre:
        updateStreetDto.nombre !== undefined
          ? updateStreetDto.nombre.trim()
          : street.nombre,
      nombre_normalizado: nombreNormalizadoFinal,
      actualizado_por: updateStreetDto.actualizado_por ?? null,
    });

    return await this.streetRepository.save(street);
  }

  async remove(id: string, eliminado_por?: string): Promise<Street> {
    const street = await this.findOne(id);

    street.activo = false;
    street.eliminado_por = eliminado_por ?? null;

    return await this.streetRepository.save(street);
  }

  async createStreetColony(
    createStreetColonyDto: CreateStreetColonyDto,
  ): Promise<StreetColony> {
    const street = await this.streetRepository.findOne({
      where: { id: createStreetColonyDto.calle_id as any },
    });

    if (!street) {
      throw new NotFoundException(
        `La calle con id ${createStreetColonyDto.calle_id} no existe.`,
      );
    }

    const colonia = await this.coloniaRepository.findOne({
      where: { id: createStreetColonyDto.colonia_id as any },
    });

    if (!colonia) {
      throw new NotFoundException(
        `La colonia con id ${createStreetColonyDto.colonia_id} no existe.`,
      );
    }

    const existingRelation = await this.streetColonyRepository.findOne({
      where: {
        calle_id: createStreetColonyDto.calle_id as any,
        colonia_id: createStreetColonyDto.colonia_id as any,
      },
    });

    if (existingRelation) {
      throw new BadRequestException(
        `La relación calle-colonia ya existe.`,
      );
    }

    const streetColony = this.streetColonyRepository.create({
      calle_id: createStreetColonyDto.calle_id,
      colonia_id: createStreetColonyDto.colonia_id,
      activo:
        createStreetColonyDto.activo !== undefined
          ? createStreetColonyDto.activo
          : true,
      creado_por: createStreetColonyDto.creado_por ?? null,
    });

    const saved = await this.streetColonyRepository.save(streetColony);

    // Recargar con relaciones completas para devolver la cadena
    // código_postal → colonia → calle en la respuesta
    return this.findStreetColonyById(saved.id);
  }

  async findAllStreetColonies(filters?: {
    calle_id?: string;
    colonia_id?: string;
    activo?: string;
  }): Promise<StreetColony[]> {
    const query = this.streetColonyRepository
      .createQueryBuilder('streetColony')
      .leftJoinAndSelect('streetColony.calle', 'calle')
      .leftJoinAndSelect('streetColony.colonia', 'colonia')
      // Cadena completa: calle → colonia → código postal → ciudad
      .leftJoinAndSelect('colonia.codigo_postal', 'cp')
      .leftJoinAndSelect('cp.ciudad', 'ciudad');

    if (filters?.calle_id) {
      query.andWhere('streetColony.calle_id = :calle_id', {
        calle_id: filters.calle_id,
      });
    }

    if (filters?.colonia_id) {
      query.andWhere('streetColony.colonia_id = :colonia_id', {
        colonia_id: filters.colonia_id,
      });
    }

    if (filters?.activo !== undefined) {
      query.andWhere('streetColony.activo = :activo', {
        activo: Number(filters.activo),
      });
    }

    query.orderBy('cp.codigo_postal', 'ASC')
         .addOrderBy('colonia.nombre', 'ASC')
         .addOrderBy('calle.nombre', 'ASC');

    return await query.getMany();
  }

  async findStreetColonyById(id: string): Promise<StreetColony> {
    const relation = await this.streetColonyRepository.findOne({
      where: { id: id as any },
      // Cadena completa: calle + colonia + código postal + ciudad
      relations: {
        calle: true,
        colonia: {
          codigo_postal: {
            ciudad: true,
          },
        },
      },
    });

    if (!relation) {
      throw new NotFoundException(
        `Relación calle-colonia con id ${id} no encontrada.`,
      );
    }

    return relation;
  }

  // Dada una calle, devuelve todas las colonias (con su CP) a las que pertenece.
  async findColoniasByStreetId(calleId: string): Promise<StreetColony[]> {
    return await this.streetColonyRepository.find({
      where: {
        calle_id: calleId as any,
        activo: true,
      },
      relations: {
        calle: true,
        colonia: {
          codigo_postal: {
            ciudad: true,
          },
        },
      },
      order: { colonia: { nombre: 'ASC' } },
    });
  }

  // Dada una colonia, devuelve todas las calles que pertenecen a ella.
  // Incluye el código postal de la colonia para mostrar la cadena completa.
  async findStreetsByColoniaId(coloniaId: string): Promise<StreetColony[]> {
    return await this.streetColonyRepository.find({
      where: {
        colonia_id: coloniaId as any,
        activo: true,
      },
      relations: {
        calle: true,
        colonia: {
          codigo_postal: {
            ciudad: true,
          },
        },
      },
      order: { calle: { nombre: 'ASC' } },
    });
  }

  async updateStreetColony(
    id: string,
    updateStreetColonyDto: UpdateStreetColonyDto,
  ): Promise<StreetColony> {
    const relation = await this.findStreetColonyById(id);

    let calleId = relation.calle_id;
    let coloniaId = relation.colonia_id;

    if (updateStreetColonyDto.calle_id) {
      const street = await this.streetRepository.findOne({
        where: { id: updateStreetColonyDto.calle_id as any },
      });

      if (!street) {
        throw new NotFoundException(
          `La calle con id ${updateStreetColonyDto.calle_id} no existe.`,
        );
      }

      calleId = updateStreetColonyDto.calle_id;
    }

    if (updateStreetColonyDto.colonia_id) {
      const colonia = await this.coloniaRepository.findOne({
        where: { id: updateStreetColonyDto.colonia_id as any },
      });

      if (!colonia) {
        throw new NotFoundException(
          `La colonia con id ${updateStreetColonyDto.colonia_id} no existe.`,
        );
      }

      coloniaId = updateStreetColonyDto.colonia_id;
    }

    const duplicate = await this.streetColonyRepository
      .createQueryBuilder('streetColony')
      .where('streetColony.calle_id = :calleId', { calleId })
      .andWhere('streetColony.colonia_id = :coloniaId', { coloniaId })
      .andWhere('streetColony.id != :id', { id })
      .getOne();

    if (duplicate) {
      throw new BadRequestException(
        `Ya existe esa relación calle-colonia.`,
      );
    }

    Object.assign(relation, {
      ...updateStreetColonyDto,
      actualizado_por: updateStreetColonyDto.actualizado_por ?? null,
    });

    return await this.streetColonyRepository.save(relation);
  }

  async removeStreetColony(
    id: string,
    eliminado_por?: string,
  ): Promise<StreetColony> {
    const relation = await this.findStreetColonyById(id);

    relation.activo = false;
    relation.eliminado_por = eliminado_por ?? null;

    return await this.streetColonyRepository.save(relation);
  }
}