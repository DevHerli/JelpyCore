import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PublicidadChat } from './entities/publicidad-chat.entity';
import { CreatePublicidadChatDto } from './dtos/create-publicidad-chat.dto';
import { FilterPublicidadChatDto } from './dtos/filter-publicidad-chat.dto';

@Injectable()
export class PublicidadChatService {
  constructor(
    @InjectRepository(PublicidadChat)
    private readonly repo: Repository<PublicidadChat>,
  ) {}

  async crear(dto: CreatePublicidadChatDto) {
    const entity = this.repo.create({
      ...dto,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: new Date(dto.fechaFin),
    });
    return this.repo.save(entity);
  }

  async findAll() {
    return this.repo.find({
      order: { fechaCreacion: 'DESC' },
    });
  }

  async findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: number) {
    return this.repo.delete(id);
  }

  /**
   * 🔥 Selección de publicidad activa para el chat
   * Filtra por:
   *  - ciudad
   *  - categoría
   *  - subcategoría
   *  - palabras clave encontradas en el mensaje
   */
  async obtenerActiva(params: FilterPublicidadChatDto): Promise<PublicidadChat | null> {
    const qb = this.repo.createQueryBuilder('p');

    qb.where('p.activo = 1')
      .andWhere('NOW() BETWEEN p.fecha_inicio AND p.fecha_fin');

    if (params.ciudad) {
      qb.andWhere('(p.ciudad IS NULL OR p.ciudad = :ciudad)', {
        ciudad: params.ciudad,
      });
    }

    if (typeof params.categoriaId === 'number') {
      qb.andWhere('(p.categoria_id IS NULL OR p.categoria_id = :catId)', {
        catId: params.categoriaId,
      });
    }

    if (typeof params.subcategoriaId === 'number') {
      qb.andWhere('(p.subcategoria_id IS NULL OR p.subcategoria_id = :subId)', {
        subId: params.subcategoriaId,
      });
    }

    // Palabras clave del texto de usuario
    if (params.texto) {
      const base = params.texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 2);

      if (base.length > 0) {
        qb.andWhere(
          new Brackets((b) => {
            base.forEach((tk, idx) => {
              const p = `w${idx}`;
              b.orWhere(`p.palabras_clave LIKE :${p}`, { [p]: `%${tk}%` });
            });
          }),
        );
      }
    }

    qb.orderBy('p.prioridad', 'DESC')
      .addOrderBy('p.fecha_creacion', 'DESC')
      .addOrderBy('RAND()') // MySQL
      .limit(1);

    const result = await qb.getOne();
    return result || null;
  }
}
