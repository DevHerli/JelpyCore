import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { CaracteristicaAplicabilidad } from './entities/caracteristicas-aplicabilidad.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { CreateCaracteristicaDto } from './dtos/create-caracteristica.dto';
import { UpdateCaracteristicaDto } from './dtos/update-caracteristica.dto';

@Injectable()
export class CaracteristicasSucursalService {
  constructor(
    @InjectRepository(CaracteristicaSucursal)
    private readonly repo: Repository<CaracteristicaSucursal>,

    @InjectRepository(CaracteristicaAplicabilidad)
    private readonly aplicabilidadRepo: Repository<CaracteristicaAplicabilidad>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,
  ) {}

  async create(dto: CreateCaracteristicaDto) {
    const existe = await this.repo.findOne({
      where: { codigo: dto.codigo },
    });

    if (existe) {
      throw new BadRequestException(
        'Ya existe una característica con ese código',
      );
    }

    const { aplicabilidades = [], ...caracteristicaData } = dto;

    const nueva = this.repo.create({
      ...caracteristicaData,
      activo: caracteristicaData.activo ?? true,
    });

    const guardada = await this.repo.save(nueva);

    if (aplicabilidades.length > 0) {
      const nuevasAplicabilidades = aplicabilidades.map((a) =>
        this.aplicabilidadRepo.create({
          caracteristicaId: guardada.id,
          nivel: a.nivel,
          referenciaId: a.nivel === 'todos' ? null : (a.referenciaId ?? null),
          activo: true,
        }),
      );

      await this.aplicabilidadRepo.save(nuevasAplicabilidades);
    }

    return this.repo.findOne({
      where: { id: guardada.id },
      relations: ['aplicabilidades'],
    });
  }

  findAll() {
    return this.repo.find({
      relations: ['aplicabilidades'],
      order: {
        id: 'DESC',
      },
    });
  }

  findByCodigo(codigo: string) {
    return this.repo.findOne({
      where: { codigo },
      relations: ['aplicabilidades'],
    });
  }

  async findOne(id: number) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades'],
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    return existente;
  }

  async update(id: number, dto: UpdateCaracteristicaDto) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades'],
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    if (dto.codigo && dto.codigo !== existente.codigo) {
      const codigoDuplicado = await this.repo.findOne({
        where: { codigo: dto.codigo },
      });

      if (codigoDuplicado) {
        throw new BadRequestException(
          'Ya existe una característica con ese código',
        );
      }
    }

    const { aplicabilidades, ...caracteristicaData } = dto;

    Object.assign(existente, caracteristicaData);
    await this.repo.save(existente);

    if (aplicabilidades) {
      await this.aplicabilidadRepo.delete({ caracteristicaId: id });

      if (aplicabilidades.length > 0) {
        const nuevasAplicabilidades = aplicabilidades.map((a) =>
          this.aplicabilidadRepo.create({
            caracteristicaId: id,
            nivel: a.nivel,
            referenciaId: a.nivel === 'todos' ? null : (a.referenciaId ?? null),
            activo: true,
          }),
        );

        await this.aplicabilidadRepo.save(nuevasAplicabilidades);
      }
    }

    return this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades'],
    });
  }

  async remove(id: number) {
    const existente = await this.repo.findOne({
      where: { id },
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    await this.aplicabilidadRepo.delete({ caracteristicaId: id });
    await this.repo.delete(id);

    return { message: 'Característica eliminada' };
  }

  /**
   * Devuelve características activas que aplican al giro indicado.
   *
   * Reglas:
   *  - Sin aplicabilidades activas → sin restricción de giro → siempre incluida.
   *  - Con aplicabilidades activas → se incluye si al menos una coincide con los
   *    IDs enviados o tiene nivel = 'todos'.
   *
   * Implementación en dos pasos para evitar problemas de deduplicación de
   * TypeORM getMany() cuando el WHERE referencia la tabla joined:
   *  1. leftJoin + getRawMany + GROUP BY → IDs de características que aplican
   *  2. Query limpio con IN (:...ids) → carga entidades con sus relaciones
   */
  async findAplicables(params: {
    categoriaId?: number;
    subcategoriaId?: number;
    especialidadId?: number;
    tipoServicioId?: number;
  }) {
    const { categoriaId, subcategoriaId, especialidadId, tipoServicioId } = params;

    // Condiciones de coincidencia (solo se agregan las que vienen definidas —
    // evita comparar campo = NULL en MySQL, que evalúa a NULL y no a FALSE).
    const matchConditions: string[] = ["a.nivel = 'todos'"];
    const bindings: Record<string, number> = {};

    if (categoriaId) {
      matchConditions.push("(a.nivel = 'categoria' AND a.referencia_id = :categoriaId)");
      bindings.categoriaId = categoriaId;
    }
    if (subcategoriaId) {
      matchConditions.push("(a.nivel = 'subcategoria' AND a.referencia_id = :subcategoriaId)");
      bindings.subcategoriaId = subcategoriaId;
    }
    if (especialidadId) {
      matchConditions.push("(a.nivel = 'especialidad' AND a.referencia_id = :especialidadId)");
      bindings.especialidadId = especialidadId;
    }
    if (tipoServicioId) {
      matchConditions.push("(a.nivel = 'tipo_servicio' AND a.referencia_id = :tipoServicioId)");
      bindings.tipoServicioId = tipoServicioId;
    }

    // Paso 1: Obtener IDs de características aplicables.
    // leftJoin (sin Select) + GROUP BY → evita duplicados por múltiples aplicabilidades.
    // a.id IS NULL → LEFT JOIN no encontró ninguna aplicabilidad activa → sin restricción.
    const matchClause = matchConditions.join(' OR ');
    const rows = await this.repo
      .createQueryBuilder('c')
      .leftJoin('c.aplicabilidades', 'a', 'a.activo = 1')
      .select('c.id', 'id')
      .where('c.activo = 1')
      .andWhere(`(a.id IS NULL OR (${matchClause}))`, bindings)
      .groupBy('c.id')
      .getRawMany<{ id: string }>();

    if (!rows.length) return [];

    const ids = rows.map((r) => Number(r.id));

    // Paso 2: Cargar entidades completas con sus aplicabilidades.
    return this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.aplicabilidades', 'apl')
      .where('c.id IN (:...ids)', { ids })
      .orderBy('c.categoriaVisual', 'ASC')
      .addOrderBy('c.nombre', 'ASC')
      .getMany();
  }

  /**
   * Resuelve automáticamente la categoría/subcategoría del negocio de la sucursal
   * y devuelve las características aplicables. El front solo necesita el sucursalId.
   *
   * Usa QueryBuilder con getRawOne() para leer los FK directamente de la tabla negocios
   * sin depender de carga de relaciones anidadas (que en TypeORM 0.3 requiere sintaxis objeto).
   */
  async findAplicablesBySucursal(sucursalId: number) {
    const row = await this.sucursalRepo
      .createQueryBuilder('s')
      .innerJoin('s.negocio', 'n')
      .select('s.id', 'sucursalId')
      .addSelect('n.categoria_id',    'categoriaId')
      .addSelect('n.subcategoria_id', 'subcategoriaId')
      .addSelect('n.especialidad_id', 'especialidadId')
      .where('s.id = :sucursalId', { sucursalId })
      .getRawOne();

    if (!row) {
      throw new NotFoundException(`Sucursal no encontrada: id=${sucursalId}`);
    }

    return this.findAplicables({
      categoriaId:    row.categoriaId    ? Number(row.categoriaId)    : undefined,
      subcategoriaId: row.subcategoriaId ? Number(row.subcategoriaId) : undefined,
      especialidadId: row.especialidadId ? Number(row.especialidadId) : undefined,
    });
  }
}