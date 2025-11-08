import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Especialidad } from './entities/especialidades.entity';
import { Subcategoria } from '../subcategorias/entities/subcategorias.entity';
import { CreateEspecialidadDto } from './dto/create-especialidad.dto';
import { UpdateEspecialidadDto } from './dto/update-especialidad.dto';

@Injectable()
export class EspecialidadesService {
  constructor(
    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,

    @InjectRepository(Subcategoria)
    private readonly subcategoriaRepo: Repository<Subcategoria>,
  ) {}

  // 🔹 Listar todas las especialidades activas
  async listar(): Promise<Especialidad[]> {
    return this.especialidadRepo.find({
      where: { activo: true },
      relations: ['subcategoria'],
      order: { nombre: 'ASC' },
    });
  }

  // 🔹 Obtener una especialidad específica
  async obtenerPorId(id: number): Promise<Especialidad> {
    const especialidad = await this.especialidadRepo.findOne({
      where: { id, activo: true },
      relations: ['subcategoria'],
    });

    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');
    return especialidad;
  }

  // 🔹 Listar especialidades por subcategoría
  async listarPorSubcategoria(subcategoriaId: number): Promise<Especialidad[]> {
    return this.especialidadRepo.find({
      where: { subcategoria: { id: subcategoriaId }, activo: true },
      relations: ['subcategoria'],
      order: { nombre: 'ASC' },
    });
  }

  // 🔹 Crear nueva especialidad
  async crear(dto: CreateEspecialidadDto): Promise<Especialidad> {
    const subcategoria = await this.subcategoriaRepo.findOne({
      where: { id: dto.subcategoria_id, activo: true },
    });

    if (!subcategoria) throw new NotFoundException('Subcategoría no encontrada o inactiva');

    const nueva = this.especialidadRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      activo: dto.activo ?? true,
      creadoPor: dto.creadoPor ?? null,
      subcategoria,
    });

    return await this.especialidadRepo.save(nueva);
  }

  // 🔹 Actualizar especialidad existente
  async actualizar(id: number, dto: UpdateEspecialidadDto): Promise<Especialidad> {
    const especialidad = await this.especialidadRepo.findOne({ where: { id }, relations: ['subcategoria'] });

    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');

    if (dto.subcategoria_id) {
      const subcategoria = await this.subcategoriaRepo.findOne({ where: { id: dto.subcategoria_id } });
      if (!subcategoria) throw new NotFoundException('Subcategoría no encontrada');
      especialidad.subcategoria = subcategoria;
    }

    especialidad.nombre = dto.nombre ?? especialidad.nombre;
    especialidad.descripcion = dto.descripcion ?? especialidad.descripcion;
    especialidad.activo = dto.activo ?? especialidad.activo;
    especialidad.actualizadoPor = dto.actualizadoPor ?? especialidad.actualizadoPor;

    return await this.especialidadRepo.save(especialidad);
  }

  // 🔹 Borrado lógico
  async eliminar(id: number, eliminadoPor?: number): Promise<{ message: string }> {
    const especialidad = await this.especialidadRepo.findOne({ where: { id } });
    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');

    especialidad.activo = false;
    especialidad.eliminadoPor = eliminadoPor ?? null;

    await this.especialidadRepo.save(especialidad);
    return { message: `Especialidad con ID ${id} desactivada correctamente` };
  }
}
