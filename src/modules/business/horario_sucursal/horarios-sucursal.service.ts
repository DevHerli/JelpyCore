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

    // UPSERT via raw SQL: findOne/queryBuilder con relaciones ManyToOne en where
    // no resuelve la FK correctamente en TypeORM + mysql2, devuelve null aunque
    // la fila exista. Raw query es la única vía 100% fiable.
    const rows: { id: number }[] = await this.horarioRepo.manager.query(
      `SELECT id FROM horarios_sucursal
       WHERE sucursal_id = ? AND dia_semana = ?
       LIMIT 1`,
      [dto.sucursalId, dto.diaSemana],
    );

    if (rows.length > 0) {
      const existenteId = rows[0].id;
      await this.horarioRepo.update(existenteId, {
        horaApertura:  dto.horaApertura  ?? undefined,
        horaCierre:    dto.horaCierre    ?? undefined,
        cerrado:       dto.cerrado       ?? false,
        observaciones: dto.observaciones ?? null,
        eliminado:     false,
      });
      return this.horarioRepo.findOne({ where: { id: existenteId } });
    }

    const nuevo = this.horarioRepo.create({ ...dto, sucursal });
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
    // Hard-delete: elimina la fila físicamente para que el índice único
    // (sucursal_id, dia_semana) quede libre y no bloquee futuros inserts.
    await this.horarioRepo.remove(horario);
    return { success: true, id };
  }
}
