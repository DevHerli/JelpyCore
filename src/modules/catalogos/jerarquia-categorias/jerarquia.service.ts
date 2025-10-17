import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../categorias/entities/categorias.entity';
import { Subcategoria } from '../subcategorias/entities/subcategorias.entity';
import { Especialidad } from '../especialidades/entities/especialidades.entity';

@Injectable()
export class JerarquiaService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,

    @InjectRepository(Subcategoria)
    private readonly subcategoriaRepo: Repository<Subcategoria>,

    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,
  ) {}

  async obtenerJerarquia() {
    // 🔹 1. Obtener categorías activas
    const categorias = await this.categoriaRepo.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });

    // 🔹 2. Obtener subcategorías activas (con su categoría relacionada)
    const subcategorias = await this.subcategoriaRepo.find({
      where: { activo: true },
      relations: ['categoria'],
      order: { nombre: 'ASC' },
    });

    // 🔹 3. Obtener especialidades activas (con su subcategoría relacionada)
    const especialidades = await this.especialidadRepo.find({
      where: { activo: true },
      relations: ['subcategoria'],
      order: { nombre: 'ASC' },
    });

    // 🔹 4. Construir jerarquía
    const data = categorias.map((cat) => {
      const subs = subcategorias
        .filter((s) => s.categoria && s.categoria.id === cat.id)
        .map((s) => ({
          id: s.id,
          nombre: s.nombre,
          descripcion: s.descripcion,
          especialidades: especialidades
            .filter((e) => e.subcategoria && e.subcategoria.id === s.id)
            .map((e) => ({
              id: e.id,
              nombre: e.nombre,
              descripcion: e.descripcion,
            })),
        }));

      return {
        id: cat.id,
        nombre: cat.nombre,
        descripcion: cat.descripcion,
        subcategorias: subs,
      };
    });

    return data;
  }
}
