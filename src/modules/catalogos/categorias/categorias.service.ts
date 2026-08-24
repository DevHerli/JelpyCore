import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Categoria } from './entities/categorias.entity';
import { CreateCategoriaDto } from './dtos/create-categoria.dto';
import { UpdateCategoriaDto } from './dtos/update-categoria.dto';
import { QueryCategoriasDto } from './dtos/query-categorias.dto';
import { MemoryCacheService } from '../../../common/cache/memory-cache.service';

// Prefijo de claves de caché de este catálogo (para invalidación por familia).
const CACHE_PREFIX = 'categorias:';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriasRepo: Repository<Categoria>,

    private readonly cache: MemoryCacheService,
  ) {}

  async create(dto: CreateCategoriaDto) {
    const nuevaCategoria = this.categoriasRepo.create({
      ...dto,
      activo: dto.activo ?? true,
    });
    const guardada = await this.categoriasRepo.save(nuevaCategoria);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardada;
  }

  /**
   * Listado con filtros (q, activo, fechas, orden, paginación)
   */
  async findAll(query?: QueryCategoriasDto) {
    const cacheKey = `${CACHE_PREFIX}findAll:${JSON.stringify(query ?? {})}`;
    return this.cache.wrap(cacheKey, () => this.findAllUncached(query));
  }

  private async findAllUncached(query?: QueryCategoriasDto) {
    const qb = this.categoriasRepo.createQueryBuilder('c');

    // relations opcionales (para que no pese siempre)
    const includeSub = query?.includeSubcategorias ?? true; // si quieres mantener tu comportamiento actual
    if (includeSub) {
      qb.leftJoinAndSelect('c.subcategorias', 's');
    }

    // q: nombre/descripcion
    if (query?.q) {
      const q = query.q.trim();
      qb.andWhere('(c.nombre LIKE :q OR c.descripcion LIKE :q)', { q: `%${q}%` });
    }

    // activo
    if (query?.activo !== undefined) {
      qb.andWhere('c.activo = :activo', { activo: query.activo });
    }

    // rango fechas por fecha_creacion
    const desde = query?.fecha_desde ? new Date(query.fecha_desde) : null;
    const hasta = query?.fecha_hasta ? new Date(query.fecha_hasta) : null;

    if (query?.fecha_desde && Number.isNaN(desde?.getTime())) {
      throw new BadRequestException('fecha_desde inválida. Usa YYYY-MM-DD o ISO.');
    }
    if (query?.fecha_hasta && Number.isNaN(hasta?.getTime())) {
      throw new BadRequestException('fecha_hasta inválida. Usa YYYY-MM-DD o ISO.');
    }

    if (desde) {
      qb.andWhere('c.fechaCreacion >= :desde', { desde });
    }
    if (hasta) {
      // si te mandan solo YYYY-MM-DD, conviene incluir todo el día:
      // aquí lo dejamos tal cual; si quieres “end of day”, lo ajustamos.
      qb.andWhere('c.fechaCreacion <= :hasta', { hasta });
    }

    // orden
    const orderBy = query?.orderBy ?? 'id';
    const orderDir = (query?.orderDir ?? 'ASC').toUpperCase() as 'ASC' | 'DESC';

    const orderMap: Record<string, string> = {
      id: 'c.id',
      nombre: 'c.nombre',
      fechaCreacion: 'c.fechaCreacion',
    };

    qb.orderBy(orderMap[orderBy] ?? 'c.id', orderDir);

    // paginación (opcional)
    const page = query?.page && query.page > 0 ? query.page : 1;
    const limit =
      query?.limit && query.limit > 0 && query.limit <= 200 ? query.limit : 50;

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Endpoint dedicado: solo activas
   */
  async findActivas() {
    return this.cache.wrap(`${CACHE_PREFIX}activas`, () =>
      this.categoriasRepo.find({
        where: { activo: true },
        relations: ['subcategorias'],
        order: { id: 'ASC' },
      }),
    );
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
    const guardada = await this.categoriasRepo.save(categoria);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardada;
  }

  /**
   * Soft delete: desactiva
   */
  async softDelete(id: number, eliminadoPor?: number) {
    const categoria = await this.findById(id);
    categoria.activo = false;
    categoria.eliminadoPor = eliminadoPor ?? null;
    const guardada = await this.categoriasRepo.save(categoria);
    this.cache.delByPrefix(CACHE_PREFIX);
    return guardada;
  }

  /**
   * Hard delete: eliminación permanente
   * Recomendación: si hay subcategorías, decide:
   * - bloquear y pedir que primero borren subcategorías
   * - o CASCADE (si tu FK lo permite)
   */
  async hardDelete(id: number) {
    // valida existencia
    await this.findById(id);

    const res = await this.categoriasRepo.delete({ id });
    if (!res.affected) {
      throw new NotFoundException('Categoría no encontrada');
    }
    this.cache.delByPrefix(CACHE_PREFIX);
    return { ok: true, message: 'Categoría eliminada permanentemente' };
  }
}
