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
import { CaracteristicaAlias } from './entities/caracteristica-alias.entity';

@Injectable()
export class CaracteristicasSucursalService {
  constructor(
    @InjectRepository(CaracteristicaSucursal)
    private readonly repo: Repository<CaracteristicaSucursal>,

    @InjectRepository(CaracteristicaAplicabilidad)
    private readonly aplicabilidadRepo: Repository<CaracteristicaAplicabilidad>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(CaracteristicaAlias)
    private readonly aliasRepo: Repository<CaracteristicaAlias>,
  ) {}

  async create(dto: CreateCaracteristicaDto) {
    const existe = await this.repo.findOne({
      where: { codigo: dto.codigo },
    });

    if (existe) {
      throw new BadRequestException('Ya existe una característica con ese código');
    }

    const { aplicabilidades = [], aliases = [], ...caracteristicaData } = dto;

    const nueva = this.repo.create({
      ...caracteristicaData,
      activo: caracteristicaData.activo ?? true,
    });

    const guardada = await this.repo.save(nueva);

    const aplicabilidadesFinales =
      aplicabilidades.length > 0
        ? aplicabilidades
        : [
            {
              nivel: 'todos' as const,
              referenciaId: null,
            },
          ];

    const nuevasAplicabilidades = aplicabilidadesFinales.map((a) =>
      this.aplicabilidadRepo.create({
        caracteristicaId: guardada.id,
        nivel: a.nivel,
        referenciaId: a.nivel === 'todos' ? null : a.referenciaId ?? null,
        activo: true,
      }),
    );

    await this.aplicabilidadRepo.save(nuevasAplicabilidades);

    const aliasesSafe = aliases ?? [];

    if (aliasesSafe.length > 0) {
      const aliasesUnicos = [
        ...new Set(
          aliasesSafe
            .map((a) => a.trim())
            .filter((a) => a.length > 0),
        ),
      ];

      const nuevosAliases = aliasesUnicos.map((alias) =>
        this.aliasRepo.create({
          caracteristicaId: guardada.id,
          alias,
          activo: true,
        }),
      );

      await this.aliasRepo.save(nuevosAliases);
    }

    return this.findOne(Number(guardada.id));
  }

  findAll() {
    return this.repo.find({
      relations: ['aplicabilidades', 'aliases'],
      order: { id: 'DESC' },
    });
  }

  findByCodigo(codigo: string) {
    return this.repo.findOne({
      where: { codigo },
      relations: ['aplicabilidades', 'aliases'],
    });
  }

  async findOne(id: number) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades', 'aliases'],
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    return existente;
  }

  async update(id: number, dto: UpdateCaracteristicaDto) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['aplicabilidades', 'aliases'],
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    if (dto.codigo && dto.codigo !== existente.codigo) {
      const codigoDuplicado = await this.repo.findOne({
        where: { codigo: dto.codigo },
      });

      if (codigoDuplicado) {
        throw new BadRequestException('Ya existe una característica con ese código');
      }
    }

    const { aplicabilidades, aliases, ...caracteristicaData } = dto;

    Object.assign(existente, caracteristicaData);
    await this.repo.save(existente);

    if (aplicabilidades !== undefined) {
      await this.aplicabilidadRepo.delete({ caracteristicaId: id });

      if (aplicabilidades.length > 0) {
        const nuevasAplicabilidades = aplicabilidades.map((a) =>
          this.aplicabilidadRepo.create({
            caracteristicaId: id,
            nivel: a.nivel,
            referenciaId: a.nivel === 'todos' ? null : a.referenciaId ?? null,
            activo: true,
          }),
        );

        await this.aplicabilidadRepo.save(nuevasAplicabilidades);
      }
    }

    if (aliases !== undefined) {
      await this.aliasRepo.delete({ caracteristicaId: id });

      const aliasesSafe = aliases ?? [];

      if (aliasesSafe.length > 0) {
        const aliasesUnicos = [
          ...new Set(
            aliasesSafe
              .map((a) => a.trim())
              .filter((a) => a.length > 0),
          ),
        ];

        const nuevosAliases = aliasesUnicos.map((alias) =>
          this.aliasRepo.create({
            caracteristicaId: id,
            alias,
            activo: true,
          }),
        );

        await this.aliasRepo.save(nuevosAliases);
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const existente = await this.repo.findOne({
      where: { id },
    });

    if (!existente) {
      throw new NotFoundException('Característica no encontrada');
    }

    await this.aliasRepo.delete({ caracteristicaId: id });
    await this.aplicabilidadRepo.delete({ caracteristicaId: id });
    await this.repo.delete(id);

    return { message: 'Característica eliminada' };
  }

  async findAplicables(params: {
    categoriaId?: number;
    subcategoriaId?: number;
    especialidadId?: number;
    tipoServicioId?: number;
  }) {
    const { categoriaId, subcategoriaId, especialidadId, tipoServicioId } =
      params;

    const matchConditions: string[] = ["a.nivel = 'todos'"];
    const bindings: Record<string, number> = {};

    if (categoriaId) {
      matchConditions.push(
        "(a.nivel = 'categoria' AND a.referencia_id = :categoriaId)",
      );
      bindings.categoriaId = categoriaId;
    }

    if (subcategoriaId) {
      matchConditions.push(
        "(a.nivel = 'subcategoria' AND a.referencia_id = :subcategoriaId)",
      );
      bindings.subcategoriaId = subcategoriaId;
    }

    if (especialidadId) {
      matchConditions.push(
        "(a.nivel = 'especialidad' AND a.referencia_id = :especialidadId)",
      );
      bindings.especialidadId = especialidadId;
    }

    if (tipoServicioId) {
      matchConditions.push(
        "(a.nivel = 'tipo_servicio' AND a.referencia_id = :tipoServicioId)",
      );
      bindings.tipoServicioId = tipoServicioId;
    }

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

    return this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.aplicabilidades', 'apl')
      .leftJoinAndSelect('c.aliases', 'alias')
      .where('c.id IN (:...ids)', { ids })
      .orderBy('c.categoriaVisual', 'ASC')
      .addOrderBy('c.nombre', 'ASC')
      .getMany();
  }

  async findAplicablesBySucursal(sucursalId: number) {
    const rows: Array<{
      sucursalId: string;
      categoriaId: string | null;
      subcategoriaId: string | null;
      especialidadId: string | null;
    }> = await this.sucursalRepo.manager.query(
      `
      SELECT 
        s.id AS sucursalId,
        n.categoria_id AS categoriaId,
        n.subcategoria_id AS subcategoriaId,
        n.especialidad_id AS especialidadId
      FROM sucursales_negocios s
      INNER JOIN negocios n ON n.id = s.negocio_id
      WHERE s.id = ?
      `,
      [sucursalId],
    );

    if (!rows.length) {
      throw new NotFoundException(`Sucursal no encontrada: id=${sucursalId}`);
    }

    const row = rows[0];

    return this.findAplicables({
      categoriaId: row.categoriaId ? Number(row.categoriaId) : undefined,
      subcategoriaId: row.subcategoriaId
        ? Number(row.subcategoriaId)
        : undefined,
      especialidadId: row.especialidadId
        ? Number(row.especialidadId)
        : undefined,
    });
  }

  async obtenerAliasesPorCaracteristicaNombre(nombre: string): Promise<string[]> {
    if (!nombre) return [];

    const caracteristica = await this.repo.findOne({
      where: { nombre },
    });

    if (!caracteristica) return [];

    const aliases = await this.aliasRepo.find({
      where: {
        caracteristicaId: caracteristica.id,
        activo: true,
      },
    });

    return [
      caracteristica.nombre,
      caracteristica.codigo,
      ...aliases.map((a) => a.alias),
    ].filter(Boolean);
  }
}