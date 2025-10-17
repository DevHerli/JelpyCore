import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from './entities/categorias.entity';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
  ) {}

  async listar(): Promise<Categoria[]> {
    return this.categoriaRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  async obtenerPorId(id: number): Promise<Categoria> {
    const categoria = await this.categoriaRepo.findOne({
      where: { id, activo: true },
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  async crear(data: Partial<Categoria>): Promise<Categoria> {
    const nueva = this.categoriaRepo.create(data);
    return this.categoriaRepo.save(nueva);
  }

  async actualizar(id: number, data: Partial<Categoria>): Promise<Categoria> {
    const categoria = await this.obtenerPorId(id);
    Object.assign(categoria, data);
    return this.categoriaRepo.save(categoria);
  }

  async eliminar(id: number): Promise<void> {
    const categoria = await this.obtenerPorId(id);
    categoria.activo = false;
    await this.categoriaRepo.save(categoria);
  }
}
