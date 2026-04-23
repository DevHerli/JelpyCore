import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SucursalCaracteristica } from './entities/sucursal-caracteristica.entity';
import { CaracteristicaSucursal } from './entities/caracteristica-sucursal.entity';
import { AssignCaracteristicaDto } from './dtos/assign-caracteristica.dto';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

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

  async assignCaracteristica(
    sucursal_id: number,
    dto: AssignCaracteristicaDto,
  ) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { id: sucursal_id },
      relations: ['negocio'],
    });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const caracteristica = await this.caracteristicaRepo.findOne({
      where: { id: dto.caracteristica_id, activo: true },
      relations: ['aplicabilidades'],
    });

    if (!caracteristica) {
      throw new NotFoundException('Característica no encontrada');
    }

    this.validarAplicabilidad(sucursal, caracteristica);

    const existe = await this.repo.findOne({
      where: {
        sucursal: { id: sucursal_id },
        caracteristica: { id: dto.caracteristica_id },
      },
      relations: ['sucursal', 'caracteristica'],
    });

    if (existe) {
      existe.valor = dto.valor;
      await this.repo.save(existe);

      return this.repo.findOne({
        where: { id: existe.id },
        relations: ['sucursal', 'caracteristica'],
      });
    }

    const nuevo = this.repo.create({
      sucursal,
      caracteristica,
      valor: dto.valor,
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

  async update(id: number, dto: AssignCaracteristicaDto) {
    const existente = await this.repo.findOne({
      where: { id },
      relations: ['sucursal', 'sucursal.negocio', 'caracteristica'],
    });

    if (!existente) {
      throw new NotFoundException('Asignación de característica no encontrada');
    }

    const caracteristica = await this.caracteristicaRepo.findOne({
      where: { id: dto.caracteristica_id, activo: true },
      relations: ['aplicabilidades'],
    });

    if (!caracteristica) {
      throw new NotFoundException('Característica no encontrada');
    }

    this.validarAplicabilidad(existente.sucursal, caracteristica);

    const duplicado = await this.repo.findOne({
      where: {
        sucursal: { id: existente.sucursal.id },
        caracteristica: { id: dto.caracteristica_id },
      },
      relations: ['sucursal', 'caracteristica'],
    });

    if (duplicado && duplicado.id !== id) {
      throw new BadRequestException(
        'La sucursal ya tiene asignada esa característica',
      );
    }

    existente.caracteristica = caracteristica;
    existente.valor = dto.valor;

    await this.repo.save(existente);

    return this.repo.findOne({
      where: { id: existente.id },
      relations: ['sucursal', 'caracteristica'],
    });
  }

  async remove(id: number) {
    const existente = await this.repo.findOne({
      where: { id },
    });

    if (!existente) {
      throw new NotFoundException('Asignación de característica no encontrada');
    }

    await this.repo.delete(id);

    return {
      message: 'Característica removida de la sucursal correctamente',
    };
  }

  private validarAplicabilidad(
    sucursal: SucursalNegocio,
    caracteristica: CaracteristicaSucursal,
  ) {
    const negocio = (sucursal as any).negocio;

    const categoriaId = negocio?.categoriaId ?? negocio?.categoria_id ?? null;
    const subcategoriaId =
      negocio?.subcategoriaId ?? negocio?.subcategoria_id ?? null;
    const especialidadId =
      negocio?.especialidadId ?? negocio?.especialidad_id ?? null;
    const tipoServicioId =
      negocio?.tipoServicioId ?? negocio?.tipo_servicio_id ?? null;

    const aplicabilidades = caracteristica.aplicabilidades ?? [];

    const aplica = aplicabilidades.some((a: any) => {
      if (!a.activo) return false;

      if (a.nivel === 'todos') return true;

      if (
        a.nivel === 'categoria' &&
        Number(a.referenciaId) === Number(categoriaId)
      ) {
        return true;
      }

      if (
        a.nivel === 'subcategoria' &&
        Number(a.referenciaId) === Number(subcategoriaId)
      ) {
        return true;
      }

      if (
        a.nivel === 'especialidad' &&
        Number(a.referenciaId) === Number(especialidadId)
      ) {
        return true;
      }

      if (
        a.nivel === 'tipo_servicio' &&
        Number(a.referenciaId) === Number(tipoServicioId)
      ) {
        return true;
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