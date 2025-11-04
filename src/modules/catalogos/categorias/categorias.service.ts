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
    const entity = this.categoriasRepo.create(dto);
    return this.categoriasRepo.save(entity);
  }

  async findAll() {
    return this.categoriasRepo.find({
      where: { activo: true },
      relations: ['subcategorias'],
    });
  }

  async update(id: number, dto: UpdateCategoriaDto) {
    const categoria = await this.categoriasRepo.findOne({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    Object.assign(categoria, dto);
    return this.categoriasRepo.save(categoria);
  }

  async softDelete(id: number) {
    const categoria = await this.categoriasRepo.findOne({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    categoria.activo = false;
    return this.categoriasRepo.save(categoria);
  }
}
