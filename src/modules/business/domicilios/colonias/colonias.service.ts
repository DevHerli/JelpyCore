import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Colonia } from './entities/colonia.entity';
import { CreateColoniaDto } from './dtos/create-colonia.dto';
import { UpdateColoniaDto } from './dtos/update-colonia.dto';
import { PostalCode } from '../codigos_postal/entities/postal-code.entity';

@Injectable()
export class ColoniasService {
  constructor(
    @InjectRepository(Colonia)
    private readonly coloniaRepository: Repository<Colonia>,

    @InjectRepository(PostalCode)
    private readonly postalCodeRepository: Repository<PostalCode>,
  ) {}

  private normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  // JLP-SEC-AUDIT-LEAK: los endpoints GET de este catálogo son públicos
  // (usados por el flujo de registro antes de login). No deben exponer
  // metadatos internos de auditoría (ids de usuarios admin que crearon/
  // editaron/eliminaron el registro). Estos helpers limpian esos campos
  // antes de responder, sin tocar los métodos internos (create/update/
  // remove) que sí necesitan el entity completo.
  private sanitizePostalCode(postalCode: PostalCode | null | undefined): any {
    if (!postalCode) return postalCode;
    const {
      creado_por,
      actualizado_por,
      eliminado_por,
      ...rest
    } = postalCode as any;
    return rest;
  }

  private sanitizeColonia(colonia: Colonia | null | undefined): any {
    if (!colonia) return colonia;
    const {
      creado_por,
      actualizado_por,
      eliminado_por,
      codigo_postal,
      ...rest
    } = colonia as any;
    return {
      ...rest,
      ...(codigo_postal !== undefined
        ? { codigo_postal: this.sanitizePostalCode(codigo_postal) }
        : {}),
    };
  }

  async create(createColoniaDto: CreateColoniaDto): Promise<Colonia> {
    const postalCode = await this.postalCodeRepository.findOne({
      where: { id: createColoniaDto.codigo_postal_id as any },
    });

    if (!postalCode) {
      throw new NotFoundException(
        `El código postal con id ${createColoniaDto.codigo_postal_id} no existe.`,
      );
    }

    const nombreNormalizado =
      createColoniaDto.nombre_normalizado?.trim() ||
      this.normalizeText(createColoniaDto.nombre);

    const existingColonia = await this.coloniaRepository.findOne({
      where: {
        codigo_postal_id: createColoniaDto.codigo_postal_id as any,
        nombre_normalizado: nombreNormalizado,
      },
    });

    if (existingColonia) {
      throw new BadRequestException(
        `Ya existe la colonia ${createColoniaDto.nombre} para el código postal ${createColoniaDto.codigo_postal_id}.`,
      );
    }

    const colonia = this.coloniaRepository.create({
      codigo_postal_id: createColoniaDto.codigo_postal_id,
      nombre: createColoniaDto.nombre.trim(),
      nombre_normalizado: nombreNormalizado,
      tipo_asentamiento: createColoniaDto.tipo_asentamiento ?? null,
      activo:
        createColoniaDto.activo !== undefined ? createColoniaDto.activo : true,
      creado_por: createColoniaDto.creado_por ?? null,
    });

    return await this.coloniaRepository.save(colonia);
  }

  async findAll(filters?: {
    codigo_postal_id?: string;
    ciudad_id?: string;
    nombre?: string;
    activo?: string;
  }): Promise<any[]> {
    const query = this.coloniaRepository
      .createQueryBuilder('colonia')
      .leftJoinAndSelect('colonia.codigo_postal', 'codigoPostal');

    if (filters?.codigo_postal_id) {
      query.andWhere('colonia.codigo_postal_id = :codigo_postal_id', {
        codigo_postal_id: filters.codigo_postal_id,
      });
    }

    if (filters?.ciudad_id) {
      query.andWhere('codigoPostal.ciudad_id = :ciudad_id', {
        ciudad_id: filters.ciudad_id,
      });
    }

    if (filters?.nombre) {
      query.andWhere(
        '(colonia.nombre LIKE :nombre OR colonia.nombre_normalizado LIKE :nombreNormalizado)',
        {
          nombre: `%${filters.nombre}%`,
          nombreNormalizado: `%${this.normalizeText(filters.nombre)}%`,
        },
      );
    }

    if (filters?.activo === undefined) {
      // Por defecto solo se muestran colonias activas (con calles cargadas).
      // Para ver también las inactivas desde un panel admin, pasar ?activo=all.
      query.andWhere('colonia.activo = :activo', { activo: 1 });
    } else if (filters.activo !== 'all') {
      query.andWhere('colonia.activo = :activo', {
        activo: Number(filters.activo),
      });
    }

    query
      .orderBy('codigoPostal.codigo_postal', 'ASC')
      .addOrderBy('colonia.nombre', 'ASC');

    const colonias = await query.getMany();
    return colonias.map((colonia) => this.sanitizeColonia(colonia));
  }

  // Carga la entidad completa (incluye campos de auditoría). Uso interno
  // exclusivo de update()/remove(); NO exponer directamente en respuestas
  // públicas — usar findOne() para eso.
  private async findOneEntity(id: string): Promise<Colonia> {
    const colonia = await this.coloniaRepository.findOne({
      where: { id: id as any },
      relations: ['codigo_postal'],
    });

    if (!colonia) {
      throw new NotFoundException(`Colonia con id ${id} no encontrada.`);
    }

    return colonia;
  }

  async findOne(id: string): Promise<any> {
    const colonia = await this.findOneEntity(id);
    return this.sanitizeColonia(colonia);
  }

  async findByPostalCodeId(codigoPostalId: string): Promise<any[]> {
    const colonias = await this.coloniaRepository.find({
      where: {
        codigo_postal_id: codigoPostalId as any,
        activo: true,
      },
      order: {
        nombre: 'ASC',
      },
    });
    return colonias.map((colonia) => this.sanitizeColonia(colonia));
  }

  async findByPostalCode(codigoPostal: string): Promise<any[]> {
    const colonias = await this.coloniaRepository
      .createQueryBuilder('colonia')
      .leftJoinAndSelect('colonia.codigo_postal', 'codigoPostal')
      .where('codigoPostal.codigo_postal = :codigoPostal', { codigoPostal })
      .andWhere('colonia.activo = :activo', { activo: 1 })
      .orderBy('colonia.nombre', 'ASC')
      .getMany();
    return colonias.map((colonia) => this.sanitizeColonia(colonia));
  }

  async findByCity(ciudadId: string): Promise<any[]> {
    const colonias = await this.coloniaRepository
      .createQueryBuilder('colonia')
      .leftJoinAndSelect('colonia.codigo_postal', 'codigoPostal')
      .where('codigoPostal.ciudad_id = :ciudadId', { ciudadId })
      .andWhere('colonia.activo = :activo', { activo: 1 })
      .orderBy('colonia.nombre', 'ASC')
      .getMany();
    return colonias.map((colonia) => this.sanitizeColonia(colonia));
  }

  async update(
    id: string,
    updateColoniaDto: UpdateColoniaDto,
  ): Promise<Colonia> {
    const colonia = await this.findOneEntity(id);

    let codigoPostalId = colonia.codigo_postal_id;
    let nombreNormalizadoFinal = colonia.nombre_normalizado;

    if (updateColoniaDto.codigo_postal_id) {
      const postalCode = await this.postalCodeRepository.findOne({
        where: { id: updateColoniaDto.codigo_postal_id as any },
      });

      if (!postalCode) {
        throw new NotFoundException(
          `El código postal con id ${updateColoniaDto.codigo_postal_id} no existe.`,
        );
      }

      codigoPostalId = updateColoniaDto.codigo_postal_id;
    }

    if (updateColoniaDto.nombre !== undefined) {
      nombreNormalizadoFinal =
        updateColoniaDto.nombre_normalizado?.trim() ||
        this.normalizeText(updateColoniaDto.nombre);
    } else if (updateColoniaDto.nombre_normalizado !== undefined) {
      nombreNormalizadoFinal = updateColoniaDto.nombre_normalizado.trim();
    }

    const duplicate = await this.coloniaRepository
      .createQueryBuilder('colonia')
      .where('colonia.codigo_postal_id = :codigoPostalId', { codigoPostalId })
      .andWhere('colonia.nombre_normalizado = :nombreNormalizadoFinal', {
        nombreNormalizadoFinal,
      })
      .andWhere('colonia.id != :id', { id })
      .getOne();

    if (duplicate) {
      throw new BadRequestException(
        `Ya existe una colonia con ese nombre para el código postal indicado.`,
      );
    }

    Object.assign(colonia, {
      ...updateColoniaDto,
      nombre:
        updateColoniaDto.nombre !== undefined
          ? updateColoniaDto.nombre.trim()
          : colonia.nombre,
      nombre_normalizado: nombreNormalizadoFinal,
      actualizado_por: updateColoniaDto.actualizado_por ?? null,
    });

    return await this.coloniaRepository.save(colonia);
  }

  async remove(id: string, eliminado_por?: string): Promise<Colonia> {
    const colonia = await this.findOneEntity(id);

    colonia.activo = false;
    colonia.eliminado_por = eliminado_por ?? null;

    return await this.coloniaRepository.save(colonia);
  }
}