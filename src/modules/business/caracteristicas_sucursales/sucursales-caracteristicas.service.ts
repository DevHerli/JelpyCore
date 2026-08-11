import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SucursalCaracteristica } from './entities/sucursal-caracteristica.entity';
import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { AssignCaracteristicaDto } from './dtos/assign-caracteristica.dto';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

// JLP-H18B — Propiedad: solo el dueño de la sucursal (o un admin) puede
// asignar/editar/quitar características. requester opcional para no romper
// llamadas internas.
export type RequesterCtx = { sub: number; isAdmin: boolean };

interface SucursalGiroContext {
  sucursalId: number;
  negocioId: number;
  categoriaId: number | null;
  subcategoriaId: number | null;
  especialidadId: number | null;
  tipoServicioId: number | null;
}

@Injectable()
export class SucursalesCaracteristicasService {
  constructor(
    @InjectRepository(SucursalCaracteristica)
    private readonly repo: Repository<SucursalCaracteristica>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(CaracteristicaSucursal)
    private readonly caracteristicaRepo: Repository<CaracteristicaSucursal>,
  ) {}

  /**
   * Verifica que el solicitante sea dueño de la sucursal (vía
   * sucursal → negocio → suscriptor) o un administrador. Se salta la
   * verificación cuando no se pasa `requester` (llamadas internas) o cuando
   * es admin.
   */
  private async assertOwnershipBySucursal(
    sucursalId: number,
    requester?: RequesterCtx,
  ) {
    if (!requester || requester.isAdmin) return;

    const sucursal = await this.sucursalRepo.findOne({
      where: { id: sucursalId },
      relations: ['negocio', 'negocio.suscriptor'],
    });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const ownerId = Number(sucursal.negocio?.suscriptor?.id);
    if (!ownerId || ownerId !== Number(requester.sub)) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar esta sucursal',
      );
    }
  }

  async assignCaracteristica(
    sucursal_id: number,
    dto: AssignCaracteristicaDto,
    requester?: RequesterCtx,
  ) {
    await this.assertOwnershipBySucursal(sucursal_id, requester);

    const sucursal = await this.sucursalRepo.findOne({
      where: { id: sucursal_id },
      relations: ['negocio'],
    });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const contexto = await this.getSucursalGiroContext(sucursal_id);

    const caracteristica = await this.caracteristicaRepo.findOne({
      where: { id: dto.caracteristica_id, activo: true },
      relations: ['aplicabilidades'],
    });

    if (!caracteristica) {
      throw new NotFoundException('Característica no encontrada');
    }

    this.validarAplicabilidad(contexto, caracteristica);

    const existe = await this.repo.findOne({
      where: {
        sucursal: { id: sucursal_id },
        caracteristica: { id: dto.caracteristica_id },
      },
      relations: ['sucursal', 'caracteristica'],
    });

    if (existe) {
      existe.valor = dto.valor ?? true;
      await this.repo.save(existe);

      return this.repo.findOne({
        where: { id: existe.id },
        relations: ['sucursal', 'caracteristica'],
      });
    }

    const nuevo = this.repo.create({
      sucursal,
      caracteristica,
      valor: dto.valor ?? true,
    });

    const guardado = await this.repo.save(nuevo);

    return this.repo.findOne({
      where: { id: guardado.id },
      relations: ['sucursal', 'caracteristica'],
    });
  }

  async getBySucursal(sucursal_id: number) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { id: sucursal_id },
    });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    return this.repo.find({
      where: { sucursal: { id: sucursal_id } },
      relations: ['caracteristica'],
      order: {
        id: 'DESC',
      },
    });
  }

  async findOne(id: number) {
    const registro = await this.repo.findOne({
      where: { id },
      relations: ['sucursal', 'caracteristica'],
    });

    if (!registro) {
      throw new NotFoundException('Asignación de característica no encontrada');
    }

    return registro;
  }

  async update(
    id: number,
    dto: AssignCaracteristicaDto,
    requester?: RequesterCtx,
  ) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['sucursal', 'caracteristica'],
    });

    if (!existente) {
      throw new NotFoundException('Asignación de característica no encontrada');
    }

    await this.assertOwnershipBySucursal(existente.sucursal.id, requester);

    const contexto = await this.getSucursalGiroContext(existente.sucursal.id);

    const caracteristica = await this.caracteristicaRepo.findOne({
      where: { id: dto.caracteristica_id, activo: true },
      relations: ['aplicabilidades'],
    });

    if (!caracteristica) {
      throw new NotFoundException('Característica no encontrada');
    }

    this.validarAplicabilidad(contexto, caracteristica);

    const duplicado = await this.repo.findOne({
      where: {
        sucursal: { id: existente.sucursal.id },
        caracteristica: { id: dto.caracteristica_id },
      },
      relations: ['sucursal', 'caracteristica'],
    });

    if (duplicado && Number(duplicado.id) !== Number(id)) {
      throw new BadRequestException(
        'La sucursal ya tiene asignada esa característica',
      );
    }

    existente.caracteristica = caracteristica;
    existente.valor = dto.valor ?? true;

    await this.repo.save(existente);

    return this.repo.findOne({
      where: { id: existente.id },
      relations: ['sucursal', 'caracteristica'],
    });
  }

  async remove(id: number, requester?: RequesterCtx) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['sucursal'],
    });

    if (!existente) {
      throw new NotFoundException('Asignación de característica no encontrada');
    }

    await this.assertOwnershipBySucursal(existente.sucursal.id, requester);

    await this.repo.delete(id);

    return {
      message: 'Característica removida de la sucursal correctamente',
    };
  }

  private async getSucursalGiroContext(
    sucursalId: number,
  ): Promise<SucursalGiroContext> {
    const rows: Array<{
      sucursalId: string;
      negocioId: string;
      categoriaId: string | null;
      subcategoriaId: string | null;
      especialidadId: string | null;
      tipoServicioId: string | null;
    }> = await this.sucursalRepo.manager.query(
      `
      SELECT 
        s.id AS sucursalId,
        n.id AS negocioId,
        n.categoria_id AS categoriaId,
        n.subcategoria_id AS subcategoriaId,
        n.especialidad_id AS especialidadId,
        NULL AS tipoServicioId
      FROM sucursales_negocios s
      INNER JOIN negocios n ON n.id = s.negocio_id
      WHERE s.id = ?
        AND s.eliminado = 0
      LIMIT 1
      `,
      [sucursalId],
    );

    if (!rows.length) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const row = rows[0];

    return {
      sucursalId: Number(row.sucursalId),
      negocioId: Number(row.negocioId),
      categoriaId: row.categoriaId ? Number(row.categoriaId) : null,
      subcategoriaId: row.subcategoriaId ? Number(row.subcategoriaId) : null,
      especialidadId: row.especialidadId ? Number(row.especialidadId) : null,
      tipoServicioId: row.tipoServicioId ? Number(row.tipoServicioId) : null,
    };
  }

  private validarAplicabilidad(
    contexto: SucursalGiroContext,
    caracteristica: CaracteristicaSucursal,
  ) {
    const aplicabilidadesActivas = (caracteristica.aplicabilidades ?? []).filter(
      (a: any) => a.activo,
    );

    if (aplicabilidadesActivas.length === 0) {
      return;
    }

    const aplica = aplicabilidadesActivas.some((a: any) => {
      const referenciaId =
        a.referenciaId !== null && a.referenciaId !== undefined
          ? Number(a.referenciaId)
          : null;

      if (a.nivel === 'todos') {
        return true;
      }

      if (a.nivel === 'categoria') {
        return referenciaId === Number(contexto.categoriaId);
      }

      if (a.nivel === 'subcategoria') {
        return referenciaId === Number(contexto.subcategoriaId);
      }

      if (a.nivel === 'especialidad') {
        return referenciaId === Number(contexto.especialidadId);
      }

      if (a.nivel === 'tipo_servicio') {
        return referenciaId === Number(contexto.tipoServicioId);
      }

      return false;
    });

    if (!aplica) {
      throw new BadRequestException(
        'La característica no aplica al giro de esta sucursal',
      );
    }
  }
}