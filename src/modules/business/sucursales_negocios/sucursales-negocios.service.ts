import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindConditions } from 'typeorm';
import { SucursalNegocio } from './entities/sucursal-negocio.entity';
import { CreateSucursalNegocioDto } from './dto/create-sucursal-negocio.dto';
import { UpdateSucursalNegocioDto } from './dto/update-sucursal-negocio.dto';

@Injectable()
export class SucursalesNegociosService {
  constructor(
    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,
  ) {}

  async crear(dto: CreateSucursalNegocioDto): Promise<SucursalNegocio> {
    const entity: SucursalNegocio = this.sucursalRepo.create({
      ...dto,
      negocio: { id: dto.negocioId } as any,
      ciudad: { id: dto.ciudadId } as any,
      estado: { id: dto.estadoId } as any,
    });
    return this.sucursalRepo.save(entity);
  }

  async listar(params?: {
    negocioId?: number;
    ciudadId?: number;
    estadoId?: number;
  }): Promise<SucursalNegocio[]> {
    const where: FindConditions<SucursalNegocio> = { eliminado: false } as any;

    if (params?.negocioId) (where as any).negocio = { id: params.negocioId } as any;
    if (params?.ciudadId) (where as any).ciudad = { id: params.ciudadId } as any;
    if (params?.estadoId) (where as any).estado = { id: params.estadoId } as any;

    return this.sucursalRepo.find({
      where,
      order: { id: 'ASC' },
      relations: ['negocio'], // ciudad y estado son eager
    });
  }

  async listarPorNegocio(negocioId: number): Promise<SucursalNegocio[]> {
    return this.listar({ negocioId });
  }

  async obtener(id: number): Promise<SucursalNegocio> {
    const suc = await this.sucursalRepo.findOne({
      where: { id, eliminado: false },
      relations: ['negocio'],
    });
    if (!suc) throw new NotFoundException('Sucursal no encontrada');
    return suc;
  }

  async actualizar(id: number, dto: UpdateSucursalNegocioDto): Promise<SucursalNegocio> {
    const suc = await this.obtener(id);

    // mapear relaciones si vienen en el DTO
    const rels: Partial<SucursalNegocio> = {};
    if (dto.negocioId) rels.negocio = { id: dto.negocioId } as any;
    if (dto.ciudadId) rels.ciudad = { id: dto.ciudadId } as any;
    if (dto.estadoId) rels.estado = { id: dto.estadoId } as any;

    Object.assign(suc, dto, rels);
    return this.sucursalRepo.save(suc);
    }

  async eliminar(id: number): Promise<void> {
    const suc = await this.obtener(id);
    suc.eliminado = true;
    await this.sucursalRepo.save(suc);
  }
}
