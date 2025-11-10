import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeywordTaxonomia } from './entities/keyword-taxonomia.entity';
import { CreateKeywordDto } from './dtos/create-keyword.dto';
import { UpdateKeywordDto } from './dtos/update-keyword.dto';

@Injectable()
export class KeywordsTaxonomiaService {
  constructor(
    @InjectRepository(KeywordTaxonomia)
    private readonly repo: Repository<KeywordTaxonomia>,
  ) {}

  // Crear nueva keyword
  async create(dto: CreateKeywordDto): Promise<KeywordTaxonomia> {
    const entity = this.repo.create(dto);
    return await this.repo.save(entity);
  }

  // Listar todas las keywords
  async findAll(): Promise<KeywordTaxonomia[]> {
    return await this.repo.find();
  }

  // Buscar por ID
  async findOne(id: number): Promise<KeywordTaxonomia> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Keyword no encontrada');
    return entity;
  }

  // Buscar por tipo y referencia
  async findByReferencia(
    tipo: 'categoria' | 'subcategoria' | 'especialidad',
    referenciaId: number,
  ): Promise<KeywordTaxonomia[]> {
    return await this.repo.find({
      where: { tipo, referenciaId },
      order: { relevancia: 'DESC' },
    });
  }

  // Actualizar keyword
  async update(id: number, dto: UpdateKeywordDto): Promise<KeywordTaxonomia> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return await this.repo.save(entity);
  }

  // Eliminar (físico)
  async remove(id: number): Promise<{ message: string }> {
    const result = await this.repo.delete(id);
    if (result.affected === 0)
      throw new NotFoundException('Keyword no encontrada');
    return { message: 'Keyword eliminada correctamente' };
  }
}
