import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Categoria } from './entities/categorias.entity';
import { CreateCategoriaDto } from './dtos/create-categoria.dto';
import { UpdateCategoriaDto } from './dtos/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriasRepo: Repository<Categoria>,
  ) {}

  /**
   * Crear una nueva categoría
   */
  async create(dto: CreateCategoriaDto) {
    const nuevaCategoria = this.categoriasRepo.create({
      ...dto,
      activo: dto.activo ?? true, // por defecto activa
    });
    return this.categoriasRepo.save(nuevaCategoria);
  }

  /**
   * Obtener todas las categorías (activas e inactivas)
   */
  async findAll() {
    return this.categoriasRepo.find({
      relations: ['subcategorias'],
      order: { id: 'ASC' },
    });
  }

  /**
   * Obtener solo las categorías activas
   */
  async findActivas() {
    return this.categoriasRepo.find({
      where: { activo: true },
      relations: ['subcategorias'],
      order: { id: 'ASC' },
    });
  }

  /**
   * Buscar una categoría por ID
   */
  async findById(id: number) {
    const categoria = await this.categoriasRepo.findOne({
      where: { id },
      relations: ['subcategorias'],
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  /**
   * Actualizar una categoría
   */
  async update(id: number, dto: UpdateCategoriaDto) {
    const categoria = await this.findById(id);
    Object.assign(categoria, dto);
    return this.categoriasRepo.save(categoria);
  }

  /**
   * Eliminado lógico (soft delete)
   */
  async softDelete(id: number, eliminadoPor?: number) {
    const categoria = await this.findById(id);
    categoria.activo = false;
    categoria.eliminadoPor = eliminadoPor ?? null;
    return this.categoriasRepo.save(categoria);
  }
}
