import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HorarioSucursal } from './entities/horarios-sucursal.entity';
import { CreateHorarioSucursalDto } from './dto/create-horario-sucursal.dto';
import { UpdateHorarioSucursalDto } from './dto/update-horario-sucursal.dto';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';

/** Identidad del solicitante para verificación de propiedad (JLP-C12). */
export type RequesterCtx = { sub: number; isAdmin: boolean };

@Injectable()
export class HorariosSucursalService {
  constructor(
    @InjectRepository(HorarioSucursal)
    private readonly horarioRepo: Repository<HorarioSucursal>,
    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,
  ) {}

  /**
   * JLP-C12 — Un horario pertenece a una sucursal, cuyo negocio tiene un
   * suscriptor dueño. Sólo el dueño (o admin) puede crear/editar/eliminar.
   */
  private assertOwnerOfSucursal(
    sucursal: SucursalNegocio | undefined | null,
    requester?: RequesterCtx,
  ): void {
    if (!requester || requester.isAdmin) return;
    const ownerId = Number((sucursal as any)?.negocio?.suscriptor?.id);
    if (!requester.sub || ownerId !== Number(requester.sub)) {
      throw new ForbiddenException('No eres el dueño de esta sucursal.');
    }
  }

  async crear(dto: CreateHorarioSucursalDto, requester?: RequesterCtx): Promise<HorarioSucursal> {
    const sucursal = await this.sucursalRepo.findOne({
      where: { id: dto.sucursalId },
      relations: ['negocio', 'negocio.suscriptor'],
    });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    this.assertOwnerOfSucursal(sucursal, requester);

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

  async actualizar(id: number, dto: UpdateHorarioSucursalDto, requester?: RequesterCtx) {
    const horario = await this.horarioRepo.findOne({
      where: { id },
      relations: ['sucursal', 'sucursal.negocio', 'sucursal.negocio.suscriptor'],
    });
    if (!horario) throw new NotFoundException('Horario no encontrado');

    this.assertOwnerOfSucursal(horario.sucursal, requester);

    Object.assign(horario, dto);
    return this.horarioRepo.save(horario);
  }

  async eliminar(id: number, requester?: RequesterCtx) {
    const horario = await this.horarioRepo.findOne({
      where: { id },
      relations: ['sucursal', 'sucursal.negocio', 'sucursal.negocio.suscriptor'],
    });
    if (!horario) throw new NotFoundException('Horario no encontrado');

    this.assertOwnerOfSucursal(horario.sucursal, requester);
    // Hard-delete: elimina la fila físicamente para que el índice único
    // (sucursal_id, dia_semana) quede libre y no bloquee futuros inserts.
    await this.horarioRepo.remove(horario);
    return { success: true, id };
  }
}
