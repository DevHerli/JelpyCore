import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subcategoria } from './entities/subcategorias.entity';
import { Categoria } from '../categorias/entities/categorias.entity';
import { Especialidad } from '../especialidades/entities/especialidades.entity';
import { CreateSubcategoriaDto } from './dto/create-subcategoria.dto';
import { UpdateSubcategoriaDto } from './dto/update-subcategoria.dto';

@Injectable()
export class SubcategoriasService {
  constructor(
    @InjectRepository(Subcategoria)
    private readonly subcategoriaRepo: Repository<Subcategoria>,

    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,

    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,
  ) {}

  // 🔹 Listar todas las subcategorías activas
  async listar(): Promise<Subcategoria[]> {
    return this.subcategoriaRepo.find({
      where: { activo: true },
      relations: ['categoria', 'especialidades'],
      order: { nombre: 'ASC' },
    });
  }

  // 🔹 Obtener una subcategoría específica
  async obtenerPorId(id: number): Promise<Subcategoria> {
    const subcategoria = await this.subcategoriaRepo.findOne({
      where: { id, activo: true },
      relations: ['categoria', 'especialidades'],
    });

    if (!subcategoria) throw new NotFoundException('Subcategoría no encontrada');
    return subcategoria;
  }

  // 🔹 Listar subcategorías por categoría
  async listarPorCategoria(categoriaId: number): Promise<Subcategoria[]> {
    return this.subcategoriaRepo.find({
      where: { categoria: { id: categoriaId }, activo: true },
      relations: ['categoria'],
      order: { nombre: 'ASC' },
    });
  }

  // 🔹 Listar especialidades de una subcategoría
  async listarEspecialidades(id: number): Promise<Especialidad[]> {
    const subcategoria = await this.subcategoriaRepo.findOne({
      where: { id, activo: true },
      relations: ['especialidades'],
    });
    if (!subcategoria) throw new NotFoundException('Subcategoría no encontrada');
    return subcategoria.especialidades;
  }

  // 🔹 Crear nueva subcategoría
  async crear(dto: CreateSubcategoriaDto): Promise<Subcategoria> {
    const categoria = await this.categoriaRepo.findOne({
      where: { id: dto.categoria_id, activo: true },
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada o inactiva');

    const nueva = this.subcategoriaRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      activo: dto.activo ?? true,
      creadoPor: dto.creadoPor ?? null,
      categoria,
    });

    return await this.subcategoriaRepo.save(nueva);
  }

  // 🔹 Actualizar subcategoría existente
  async actualizar(id: number, dto: UpdateSubcategoriaDto): Promise<Subcategoria> {
    const subcategoria = await this.subcategoriaRepo.findOne({
      where: { id },
      relations: ['categoria'],
    });
    if (!subcategoria) throw new NotFoundException('Subcategoría no encontrada');

    if (dto.categoria_id) {
      const categoria = await this.categoriaRepo.findOne({ where: { id: dto.categoria_id } });
      if (!categoria) throw new NotFoundException('Categoría no encontrada');
      subcategoria.categoria = categoria;
    }

    subcategoria.nombre = dto.nombre ?? subcategoria.nombre;
    subcategoria.descripcion = dto.descripcion ?? subcategoria.descripcion;
    subcategoria.activo = dto.activo ?? subcategoria.activo;
    subcategoria.actualizadoPor = dto.actualizadoPor ?? subcategoria.actualizadoPor;

    return await this.subcategoriaRepo.save(subcategoria);
  }

  // 🔹 Borrado lógico
  async eliminar(id: number, eliminadoPor?: number): Promise<{ message: string }> {
    const subcategoria = await this.subcategoriaRepo.findOne({ where: { id } });
    if (!subcategoria) throw new NotFoundException('Subcategoría no encontrada');

    subcategoria.activo = false;
    subcategoria.eliminadoPor = eliminadoPor ?? null;
    await this.subcategoriaRepo.save(subcategoria);

    return { message: `Subcategoría con ID ${id} desactivada correctamente` };
  }
}
