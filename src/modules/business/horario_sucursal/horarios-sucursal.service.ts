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

    // INSERT ... ON DUPLICATE KEY UPDATE: MySQL resuelve el conflicto del índice
    // único (sucursal_id, dia_semana) a nivel de motor — nunca puede lanzar
    // Duplicate entry, independientemente de si la fila existe o está soft-deleted.
    await this.horarioRepo.manager.query(
      `INSERT INTO horarios_sucursal
         (sucursal_id, dia_semana, hora_apertura, hora_cierre, cerrado, observaciones, eliminado, fecha_registro)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
       ON DUPLICATE KEY UPDATE
         hora_apertura    = VALUES(hora_apertura),
         hora_cierre      = VALUES(hora_cierre),
         cerrado          = VALUES(cerrado),
         observaciones    = VALUES(observaciones),
         eliminado        = 0,
         fecha_actualizacion = NOW()`,
      [
        dto.sucursalId,
        dto.diaSemana,
        dto.horaApertura ?? null,
        dto.horaCierre   ?? null,
        dto.cerrado      ? 1 : 0,
        dto.observaciones ?? null,
      ],
    );

    // Devolver la fila resultante (nueva o actualizada)
    const result = await this.horarioRepo.manager.query(
      `SELECT * FROM horarios_sucursal
       WHERE sucursal_id = ? AND dia_semana = ?
       LIMIT 1`,
      [dto.sucursalId, dto.diaSemana],
    );

    return result[0] as HorarioSucursal;
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
