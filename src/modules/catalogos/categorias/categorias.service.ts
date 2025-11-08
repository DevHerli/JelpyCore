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

  async create(dto: CreateCategoriaDto) {
    const nuevaCategoria = this.categoriasRepo.create({
      ...dto,
      activo: dto.activo ?? true,
    });
    return this.categoriasRepo.save(nuevaCategoria);
  }

  async findAll() {
    return this.categoriasRepo.find({
      where: { activo: true },
      relations: ['subcategorias'],
      order: { id: 'ASC' },
    });
  }

  async findById(id: number) {
    const categoria = await this.categoriasRepo.findOne({
      where: { id },
      relations: ['subcategorias'],
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  async update(id: number, dto: UpdateCategoriaDto) {
    const categoria = await this.findById(id);
    Object.assign(categoria, dto);
    return this.categoriasRepo.save(categoria);
  }

  async softDelete(id: number, eliminadoPor?: number) {
    const categoria = await this.findById(id);
    categoria.activo = false;
    categoria.eliminadoPor = eliminadoPor ?? null;
    return this.categoriasRepo.save(categoria);
  }
}
