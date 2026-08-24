import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Especialidad } from './entities/especialidades.entity';
import { Subcategoria } from '../subcategorias/entities/subcategorias.entity';
import { CreateEspecialidadDto } from './dto/create-especialidad.dto';
import { UpdateEspecialidadDto } from './dto/update-especialidad.dto';
import { MemoryCacheService } from '../../../common/cache/memory-cache.service';

// Prefijo de claves de caché de este catálogo (para invalidación por familia).
const CACHE_PREFIX = 'especialidades:';

@Injectable()
export class EspecialidadesService {
  constructor(
    @InjectRepository(Especialidad)
    private readonly especialidadRepo: Repository<Especialidad>,

    @InjectRepository(Subcategoria)
    private readonly subcategoriaRepo: Repository<Subcategoria>,

    private readonly cache: MemoryCacheService,
  ) {}

  /**
   * 🔹 Listar todas las especialidades activas (cacheado — catálogo casi estático)
   */
  async listar(): Promise<Especialidad[]> {
    return this.cache.wrap(`${CACHE_PREFIX}listar`, () =>
      this.especialidadRepo.find({
        where: { activo: true },
        relations: ['subcategoria'],
        order: { nombre: 'ASC' },
      }),
    );
  }

  /**
   * 🔹 Obtener una especialidad específica
   */
  async obtenerPorId(id: number): Promise<Especialidad> {
    const especialidad = await this.especialidadRepo.findOne({
      where: { id, activo: true },
      relations: ['subcategoria'],
    });

    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');
    return especialidad;
  }

  /**
   * 🔹 Listar especialidades por subcategoría
   */
  async listarPorSubcategoria(subcategoriaId: number): Promise<Especialidad[]> {
    return this.cache.wrap(`${CACHE_PREFIX}sub:${subcategoriaId}`, () =>
      this.especialidadRepo.find({
        where: { subcategoria: { id: subcategoriaId }, activo: true },
        relations: ['subcategoria'],
        order: { nombre: 'ASC' },
      }),
    );
  }

  /**
   * 🔹 Crear nueva especialidad
   */
  async crear(dto: CreateEspecialidadDto): Promise<Especialidad> {
    const subcategoria = await this.subcategoriaRepo.findOne({
      where: { id: dto.subcategoria_id, activo: true },
    });

    if (!subcategoria)
      throw new NotFoundException('Subcategoría no encontrada o inactiva');

    const nueva = this.especialidadRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      activo: dto.activo ?? true,
      creadoPor: dto.creadoPor ?? null,
      subcategoria,
    });

    const guardada = await this.especialidadRepo.save(nueva);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardada;
  }

  /**
   * 🔹 Actualizar especialidad existente
   */
  async actualizar(
    id: number,
    dto: UpdateEspecialidadDto,
  ): Promise<Especialidad> {
    const especialidad = await this.especialidadRepo.findOne({
      where: { id },
      relations: ['subcategoria'],
    });

    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');

    if (dto.subcategoria_id) {
      const subcategoria = await this.subcategoriaRepo.findOne({
        where: { id: dto.subcategoria_id },
      });
      if (!subcategoria)
        throw new NotFoundException('Subcategoría no encontrada');
      especialidad.subcategoria = subcategoria;
    }

    especialidad.nombre = dto.nombre ?? especialidad.nombre;
    especialidad.descripcion = dto.descripcion ?? especialidad.descripcion;
    especialidad.activo = dto.activo ?? especialidad.activo;
    especialidad.actualizadoPor =
      dto.actualizadoPor ?? especialidad.actualizadoPor;
    especialidad.fechaActualizacion = new Date();

    const guardada = await this.especialidadRepo.save(especialidad);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardada;
  }

  /**
   * Borrado lógico — desactiva la especialidad (activo = 0)
   */
  async eliminar(id: number, eliminadoPor?: number): Promise<{ message: string }> {
    const especialidad = await this.especialidadRepo.findOne({ where: { id } });
    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');

    especialidad.activo = false;
    especialidad.eliminadoPor = eliminadoPor ?? null;
    especialidad.fechaActualizacion = new Date();

    await this.especialidadRepo.save(especialidad);
    this.cache.delByPrefix(CACHE_PREFIX);
    return { message: `Especialidad con ID ${id} desactivada correctamente` };
  }

  /**
   * Borrado físico — elimina definitivamente si ya está inactiva
   */
  async borrarFisico(id: number): Promise<{ message: string }> {
    const especialidad = await this.especialidadRepo.findOne({ where: { id } });
    if (!especialidad) throw new NotFoundException('Especialidad no encontrada');

    if (especialidad.activo)
      throw new BadRequestException(
        'No se puede eliminar físicamente una especialidad activa',
      );

    await this.especialidadRepo.remove(especialidad);
    this.cache.delByPrefix(CACHE_PREFIX);
    return { message: `Especialidad con ID ${id} eliminada definitivamente` };
  }
}
