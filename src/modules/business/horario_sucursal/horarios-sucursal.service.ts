import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HorarioSucursal } from './entities/horarios-sucursal.entity';
import { CreateHorarioSucursalDto } from './dto/create-horario-sucursal.dto';
import { UpdateHorarioSucursalDto } from './dto/update-horario-sucursal.dto';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

@Injectable()
export class HorariosSucursalService {
  constructor(
    @InjectRepository(HorarioSucursal)
    private readonly horarioRepo: Repository<HorarioSucursal>,
    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,
  ) {}

  async crear(dto: CreateHorarioSucursalDto): Promise<HorarioSucursal> {
    const sucursal = await this.sucursalRepo.findOne({ where: { id: dto.sucursalId } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    const nuevo = this.horarioRepo.create({
      ...dto,
      sucursal,
    });

    return this.horarioRepo.save(nuevo);
  }

  async listar(): Promise<HorarioSucursal[]> {
    return this.horarioRepo.find({
      where: { eliminado: false },
      relations: ['sucursal'],
    });
  }

  async listarPorSucursal(sucursalId: number): Promise<HorarioSucursal[]> {
    return this.horarioRepo.find({
      where: { sucursal: { id: sucursalId }, eliminado: false },
    });
  }

  async actualizar(id: number, dto: UpdateHorarioSucursalDto) {
    const horario = await this.horarioRepo.findOne({ where: { id } });
    if (!horario) throw new NotFoundException('Horario no encontrado');

    Object.assign(horario, dto);
    return this.horarioRepo.save(horario);
  }

  async eliminar(id: number) {
    const horario = await this.horarioRepo.findOne({ where: { id } });
    if (!horario) throw new NotFoundException('Horario no encontrado');
    horario.eliminado = true;
    return this.horarioRepo.save(horario);
  }
}
