import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PostalCode } from './entities/postal-code.entity';
import { CreatePostalCodeDto } from './dtos/create-postal-code.dto';
import { UpdatePostalCodeDto } from './dtos/update-postal-code.dto';
import { Ciudad } from '../../../catalogos/ciudades/entities/ciudades.entity';

@Injectable()
export class PostalCodesService {
  constructor(
    @InjectRepository(PostalCode)
    private readonly postalCodeRepository: Repository<PostalCode>,

    @InjectRepository(Ciudad)
    private readonly ciudadRepository: Repository<Ciudad>,
  ) {}

  async create(createPostalCodeDto: CreatePostalCodeDto): Promise<PostalCode> {
    const ciudad = await this.ciudadRepository.findOne({
      where: { id: createPostalCodeDto.ciudad_id as any },
    });

    if (!ciudad) {
      throw new NotFoundException(
        `La ciudad con id ${createPostalCodeDto.ciudad_id} no existe.`,
      );
    }

    const existingPostalCode = await this.postalCodeRepository.findOne({
      where: {
        ciudad_id: createPostalCodeDto.ciudad_id as any,
        codigo_postal: createPostalCodeDto.codigo_postal,
      },
    });

    if (existingPostalCode) {
      throw new BadRequestException(
        `Ya existe el código postal ${createPostalCodeDto.codigo_postal} para la ciudad ${createPostalCodeDto.ciudad_id}.`,
      );
    }

    const postalCode = this.postalCodeRepository.create({
      ciudad_id: createPostalCodeDto.ciudad_id,
      codigo_postal: createPostalCodeDto.codigo_postal,
      tipo_asentamiento_principal:
        createPostalCodeDto.tipo_asentamiento_principal ?? null,
      activo:
        createPostalCodeDto.activo !== undefined
          ? createPostalCodeDto.activo
          : true,
      creado_por: createPostalCodeDto.creado_por ?? null,
    });

    return await this.postalCodeRepository.save(postalCode);
  }

  // JLP-SEC-AUDIT-LEAK: los endpoints GET de este catálogo son públicos
  // (usados por el flujo de registro antes de login, igual que colonias).
  // No deben exponer metadatos internos de auditoría (ids de usuarios
  // admin que crearon/editaron/eliminaron el registro). Este helper limpia
  // esos campos antes de responder, sin tocar los métodos internos
  // (create/update/remove) que sí necesitan el entity completo.
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

  async findAll(filters?: {
    ciudad_id?: string;
    codigo_postal?: string;
    activo?: string;
  }): Promise<any[]> {
    const query = this.postalCodeRepository
      .createQueryBuilder('postalCode')
      .leftJoinAndSelect('postalCode.ciudad', 'ciudad');

    if (filters?.ciudad_id) {
      query.andWhere('postalCode.ciudad_id = :ciudad_id', {
        ciudad_id: filters.ciudad_id,
      });
    }

    if (filters?.codigo_postal) {
      query.andWhere('postalCode.codigo_postal LIKE :codigo_postal', {
        codigo_postal: `%${filters.codigo_postal}%`,
      });
    }

    if (filters?.activo !== undefined) {
      query.andWhere('postalCode.activo = :activo', {
        activo: Number(filters.activo),
      });
    }

    query.orderBy('postalCode.codigo_postal', 'ASC');

    const postalCodes = await query.getMany();
    return postalCodes.map((pc) => this.sanitizePostalCode(pc));
  }

  // Carga la entidad completa (incluye campos de auditoría). Uso interno
  // exclusivo de update()/remove(); NO exponer directamente en respuestas
  // públicas — usar findOne() para eso.
  private async findOneEntity(id: string): Promise<PostalCode> {
    const postalCode = await this.postalCodeRepository.findOne({
      where: { id: id as any },
      relations: ['ciudad'],
    });

    if (!postalCode) {
      throw new NotFoundException(
        `Código postal con id ${id} no encontrado.`,
      );
    }

    return postalCode;
  }

  async findOne(id: string): Promise<any> {
    const postalCode = await this.findOneEntity(id);
    return this.sanitizePostalCode(postalCode);
  }

  async findByCity(ciudadId: string): Promise<any[]> {
    const postalCodes = await this.postalCodeRepository.find({
      where: {
        ciudad_id: ciudadId as any,
        activo: true,
      },
      order: {
        codigo_postal: 'ASC',
      },
    });
    return postalCodes.map((pc) => this.sanitizePostalCode(pc));
  }

  async findByPostalCode(codigoPostal: string): Promise<any[]> {
    const postalCodes = await this.postalCodeRepository.find({
      where: {
        codigo_postal: codigoPostal,
      },
      relations: ['ciudad'],
      order: {
        codigo_postal: 'ASC',
      },
    });
    return postalCodes.map((pc) => this.sanitizePostalCode(pc));
  }

  async update(
    id: string,
    updatePostalCodeDto: UpdatePostalCodeDto,
  ): Promise<PostalCode> {
    const postalCode = await this.findOneEntity(id);

    if (
      updatePostalCodeDto.ciudad_id !== undefined ||
      updatePostalCodeDto.codigo_postal !== undefined
    ) {
      const ciudadId = updatePostalCodeDto.ciudad_id ?? postalCode.ciudad_id;
      const codigoPostal =
        updatePostalCodeDto.codigo_postal ?? postalCode.codigo_postal;

      const duplicate = await this.postalCodeRepository
        .createQueryBuilder('postalCode')
        .where('postalCode.ciudad_id = :ciudadId', { ciudadId })
        .andWhere('postalCode.codigo_postal = :codigoPostal', { codigoPostal })
        .andWhere('postalCode.id != :id', { id })
        .getOne();

      if (duplicate) {
        throw new BadRequestException(
          `Ya existe el código postal ${codigoPostal} para la ciudad ${ciudadId}.`,
        );
      }
    }

    if (updatePostalCodeDto.ciudad_id) {
      const ciudad = await this.ciudadRepository.findOne({
        where: { id: updatePostalCodeDto.ciudad_id as any },
      });

      if (!ciudad) {
        throw new NotFoundException(
          `La ciudad con id ${updatePostalCodeDto.ciudad_id} no existe.`,
        );
      }
    }

    Object.assign(postalCode, {
      ...updatePostalCodeDto,
      actualizado_por: updatePostalCodeDto.actualizado_por ?? null,
    });

    return await this.postalCodeRepository.save(postalCode);
  }

  async remove(id: string, eliminado_por?: string): Promise<PostalCode> {
    const postalCode = await this.findOneEntity(id);

    postalCode.activo = false;
    postalCode.eliminado_por = eliminado_por ?? null;

    return await this.postalCodeRepository.save(postalCode);
  }
}