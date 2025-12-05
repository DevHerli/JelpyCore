import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SucursalCaracteristica } from './entities/sucursal-caracteristica.entity';
import { AssignCaracteristicaDto } from './dtos/assign-caracteristica.dto';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

@Injectable()
export class SucursalesCaracteristicasService {
  constructor(
    @InjectRepository(SucursalCaracteristica)
    private repo: Repository<SucursalCaracteristica>,

    @InjectRepository(SucursalNegocio)
    private sucursalRepo: Repository<SucursalNegocio>,
  ) {}

  async assignCaracteristica(
    sucursal_id: number,
    dto: AssignCaracteristicaDto,
  ) {
    const sucursal = await this.sucursalRepo.findOne({ where: { id: sucursal_id } });

    const existe = await this.repo.findOne({
      where: {
        sucursal: { id: sucursal_id },
        caracteristica: { id: dto.caracteristica_id },
      },
    });

    if (existe) {
      existe.valor = dto.valor;
      return this.repo.save(existe);
    }

    const nuevo = this.repo.create({
      sucursal,
      caracteristica: { id: dto.caracteristica_id },
      valor: dto.valor,
    });

    return this.repo.save(nuevo);
  }

  getBySucursal(sucursal_id: number) {
    return this.repo.find({
      where: { sucursal: { id: sucursal_id } },
      relations: ['caracteristica'],
    });
  }
}
