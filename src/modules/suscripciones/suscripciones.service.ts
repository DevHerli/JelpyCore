import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { Membresia } from '../business/membresias/entities/membresia.entity';
import { SuscriptorSuscripcion } from './entities/suscriptor-suscripcion.entity';
import { SuscripcionCiclo } from './entities/suscripcion-ciclo.entity';
import { MembresiaCuotas } from './entities/membresia-cuotas.entity';
import { CrearSuscripcionDto } from './dtos/crear-suscripcion.dto';
import { UpsertMembresiaCuotasDto } from './dtos/upsert-membresia-cuotas.dto';
import { EstadoCuentaMovimiento } from './entities/estado-cuenta-movimiento.entity';
import { CrearEstadoCuentaMovimientoDto } from './dtos/crear-estado-cuenta-movimiento.dto';

type ResumenCuota = { max: number; extra: number; usados: number; disponibles: number };

@Injectable()
export class SuscripcionesService {
  constructor(
    @InjectRepository(SuscriptorSuscripcion)
    private readonly susRepo: Repository<SuscriptorSuscripcion>,
    @InjectRepository(SuscripcionCiclo)
    private readonly ciclosRepo: Repository<SuscripcionCiclo>,
    @InjectRepository(MembresiaCuotas)
    private readonly cuotasRepo: Repository<MembresiaCuotas>,
    @InjectRepository(Suscriptor)
    private readonly suscriptoresRepo: Repository<Suscriptor>,
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    private readonly dataSource: DataSource,
    @InjectRepository(EstadoCuentaMovimiento)
    private readonly ecmRepo: Repository<EstadoCuentaMovimiento>,
  ) {}

  async obtenerSuscripcionActiva(suscriptorId: number): Promise<SuscriptorSuscripcion> {
    const suscripcion = await this.susRepo.findOne({
      where: {
        suscriptor: { id: suscriptorId } as any,
        estatus: 'activa',
      },
      order: { id: 'DESC' },
      relations: { suscriptor: true } as any,
    });

    if (!suscripcion) {
      throw new NotFoundException(`No se encontró suscripción activa para suscriptor_id=${suscriptorId}`);
    }
    return suscripcion;
  }

  /**
   * Obtiene o crea el ciclo actual de una suscripción (según reset_periodo de la cuota de membresía).
   * Por ahora: mensual/anual. (una_vez => un ciclo infinito muy largo)
   */
  async obtenerOCrearCicloActual(suscripcion: SuscriptorSuscripcion): Promise<SuscripcionCiclo> {
    const cuotas = await this.obtenerCuotasDeMembresia(suscripcion.membresia.id);

    const hoy = new Date();
    const { inicio, fin } = this.calcularRangoCiclo(hoy, cuotas.resetPeriodo);

    // ✅ FIX PRODUCCIÓN:
    // "get or create" idempotente para evitar Duplicate entry uq_ciclo_unico
    // usamos query raw ON DUPLICATE y luego consultamos.
    const inicioSql = this.formatearFechaSQL(inicio);
    const finSql = this.formatearFechaSQL(fin);

    await this.dataSource.query(
      `
      INSERT INTO suscripcion_ciclos
        (suscripcion_id, ciclo_inicio, ciclo_fin,
         negocios_usados, promociones_usadas, anuncios_usados,
         negocios_extra, promociones_extra, anuncios_extra,
         fecha_creacion)
      VALUES
        (?, ?, ?, 0, 0, 0, 0, 0, 0, NOW())
      ON DUPLICATE KEY UPDATE
        id = id
      `,
      [suscripcion.id, inicioSql, finSql],
    );

    const ciclo = await this.ciclosRepo.findOne({
      where: {
        suscripcion: { id: suscripcion.id } as any,
        cicloInicio: inicio,
        cicloFin: fin,
      },
      relations: { suscripcion: true } as any,
    });

    if (!ciclo) {
      throw new Error('No se pudo obtener el ciclo actual después del upsert.');
    }

    return ciclo;
  }

  async obtenerCuotasDeMembresia(membresiaId: number): Promise<MembresiaCuotas> {
    const cuotas = await this.cuotasRepo.findOne({
      where: { membresia: { id: membresiaId } as any },
    });

    if (!cuotas) {
      // producción: si no hay registro, es error de configuración del plan
      throw new NotFoundException(`No existe configuración de cuotas para membresia_id=${membresiaId}`);
    }
    return cuotas;
  }

  async obtenerResumenSuscriptor(suscriptorId: number) {
    // 2.2 — Devuelve 200 con subscription:null si no hay suscripción activa (no 404)
    let suscripcion: SuscriptorSuscripcion | null = null;
    try {
      suscripcion = await this.obtenerSuscripcionActiva(suscriptorId);
    } catch {
      return { suscriptorId, subscription: null, suscripcion: null, cicloActual: null, cuotas: null };
    }

    let cuotas: MembresiaCuotas | null = null;
    let ciclo: any = null;
    try {
      cuotas = await this.obtenerCuotasDeMembresia(suscripcion.membresia.id);
      ciclo  = await this.obtenerOCrearCicloActual(suscripcion);
    } catch { /* cuotas no configuradas — devuelve resumen sin ciclo */ }

    const anunciosMax = suscripcion.membresia.anunciosIlimitados
      ? 1_000_000_000
      : (cuotas?.maxAnuncios || suscripcion.membresia.anunciosMensuales || 0);

    const cuotasResumen = cuotas && ciclo ? {
      negocios:   this.calcularCuota(cuotas.maxNegocios,   ciclo.negociosExtra,   ciclo.negociosUsados),
      promociones: this.calcularCuota(cuotas.maxPromociones, ciclo.promocionesExtra, ciclo.promocionesUsadas),
      anuncios:   this.calcularCuota(anunciosMax,           ciclo.anunciosExtra,   ciclo.anunciosUsados),
    } : null;

    const suscripcionPayload = {
      id:                   suscripcion.id,
      estatus:              suscripcion.estatus,
      fechaInicio:          suscripcion.fechaInicio,
      fechaFin:             suscripcion.fechaFin,
      proximaFechaCorte:    suscripcion.proximaFechaCorte,
      renovacionAutomatica: !!suscripcion.renovacionAutomatica,
      autoRenew:            !!suscripcion.renovacionAutomatica,  // alias que usa el front
      nextBillingDate:      suscripcion.proximaFechaCorte ?? null,
      membresia: {
        id:           suscripcion.membresia.id,
        nombre:       suscripcion.membresia.nombre,
        name:         suscripcion.membresia.nombre,  // alias para el front
        duracionMeses: suscripcion.membresia.duracion_meses,
        precio:       suscripcion.membresia.precio,
      },
      membership: {
        name: suscripcion.membresia.nombre,
      },
    };

    return {
      suscriptorId,
      subscription: suscripcionPayload,  // alias esperado por el front
      suscripcion:  suscripcionPayload,
      cicloActual: ciclo ? { id: ciclo.id, cicloInicio: ciclo.cicloInicio, cicloFin: ciclo.cicloFin } : null,
      cuotas: cuotasResumen,
    };
  }

  /** 2.1 Toggle de renovación automática */
  async setAutoRenew(suscriptorId: number, autoRenew: boolean) {
    const suscripcion = await this.susRepo.findOne({
      where: { suscriptor: { id: suscriptorId } as any, estatus: 'activa' },
      order: { id: 'DESC' },
    });

    if (!suscripcion) {
      // Graceful: no hay suscripción activa, respondemos ok sin error
      return { ok: true, autoRenew };
    }

    suscripcion.renovacionAutomatica = autoRenew;
    await this.susRepo.save(suscripcion);
    return { ok: true, autoRenew };
  }

  /**
   * Crea o renueva la suscripción activa tras un pago confirmado.
   * Llamado desde PagosService.markAsPaid (best-effort, no bloquea el pago).
   */
  async renovarOCrearSuscripcion(params: {
    suscriptorId: number;
    membresiaId:  number;
    pagoId:       number;
  }) {
    const { suscriptorId, membresiaId } = params;

    const membresia = await this.membresiasRepo.findOne({ where: { id: membresiaId } });
    if (!membresia) throw new NotFoundException(`Membresía no existe: id=${membresiaId}`);

    const duracionMeses = Number(membresia.duracion_meses) || 1;
    const hoy      = new Date();
    const fechaFin = new Date(hoy);
    fechaFin.setMonth(fechaFin.getMonth() + duracionMeses);

    // Buscar suscripción activa existente
    const activa = await this.susRepo.findOne({
      where: { suscriptor: { id: suscriptorId } as any, estatus: 'activa' },
      relations: { suscriptor: true, membresia: true } as any,
      order: { id: 'DESC' },
    });

    if (activa) {
      if (Number(activa.membresia?.id) === membresiaId) {
        // Misma membresía → extender fecha_fin
        activa.fechaFin           = fechaFin;
        activa.proximaFechaCorte  = fechaFin;
        activa.proveedorPago      = 'stripe';
        await this.susRepo.save(activa);
      } else {
        // Cambio de plan
        await this.cambiarPlan({
          suscriptorId,
          nuevaMembresiaId: membresiaId,
          fechaInicio:      hoy.toISOString(),
          proximaFechaCorte: fechaFin.toISOString(),
          renovacionAutomatica: !!activa.renovacionAutomatica,
        });
      }
    } else {
      // No hay activa → crear
      await this.crearSuscripcion({
        suscriptorId,
        membresiaId,
        estatus: 'activa',
        fechaInicio: hoy.toISOString(),
        fechaFin: fechaFin.toISOString(),
        proximaFechaCorte: fechaFin.toISOString(),
        proveedorPago: 'stripe',
      });
    }

    // Sincronizar suscriptores.membresia_id con el plan pagado.
    // Es crítico: getPlacementsPermitidos y getDashboard leen s.membresia_id
    // directamente (no la suscripcion activa), por lo que si no se actualiza
    // el suscriptor sigue viendo los permisos y cuotas de su plan anterior.
    await this.suscriptoresRepo.update(
      { id: suscriptorId },
      { membresia: { id: membresiaId } as any },
    );
  }


  async obtenerEstadoCuenta(suscriptorId: number) {
  // valida suscriptor
  const suscriptor = await this.suscriptoresRepo.findOne({
    where: { id: suscriptorId },
    select: ['id'] as any,
  });

  if (!suscriptor) {
    throw new NotFoundException(`Suscriptor no existe: id=${suscriptorId}`);
  }

  // trae movimientos recientes
  const movimientos = await this.ecmRepo.find({
    where: { suscriptorId },
    order: { fechaCreacion: 'DESC', id: 'DESC' },
    take: 50,
  });

  // saldo actual = el saldo del movimiento más reciente (si existe)
const saldoActualCentavos =
  movimientos.length > 0 ? Number(movimientos[0].saldoDespuesCentavos || 0) : 0;

  return {
    suscriptorId,
    saldoActualCentavos,
    moneda: 'MXN',
    movimientos: movimientos.map((m) => {
      const cargo = Number(m.cargoCentavos || 0);
      const abono = Number(m.abonoCentavos || 0);
      const saldo = Number(m.saldoDespuesCentavos || 0);
      // referencia legible: "pagos#42" o null
      const referencia =
        m.referenciaTabla && m.referenciaId != null
          ? `${m.referenciaTabla}#${m.referenciaId}`
          : null;

      return {
        // ── campos originales (backward compat) ──
        id:                   Number(m.id),
        tipoMovimiento:       m.tipoMovimiento,
        descripcion:          m.descripcion,
        referenciaTabla:      m.referenciaTabla ?? null,
        referenciaId:         m.referenciaId != null ? Number(m.referenciaId) : null,
        cargoCentavos:        cargo,
        abonoCentavos:        abono,
        saldoDespuesCentavos: saldo,
        moneda:               m.moneda,
        fechaCreacion:        m.fechaCreacion,
        // ── aliases que espera el front ──
        fecha:         m.fechaCreacion,
        concepto:      m.descripcion,
        tipo:          m.tipoMovimiento,
        montoCentavos: cargo > 0 ? cargo : abono,
        saldoCentavos: saldo,
        referencia,
      };
    }),
  };
}


  async crearSuscripcion(dto: CrearSuscripcionDto): Promise<SuscriptorSuscripcion> {
    const suscriptor = await this.suscriptoresRepo.findOne({ where: { id: dto.suscriptorId } });
    if (!suscriptor) throw new NotFoundException(`Suscriptor no existe: id=${dto.suscriptorId}`);

    const membresia = await this.membresiasRepo.findOne({ where: { id: dto.membresiaId } });
    if (!membresia) throw new NotFoundException(`Membresía no existe: id=${dto.membresiaId}`);

    // regla: no crear otra activa si ya hay una activa
    const activa = await this.susRepo.findOne({
      where: { suscriptor: { id: dto.suscriptorId } as any, estatus: 'activa' },
    });
    if (activa) throw new BadRequestException('El suscriptor ya tiene una suscripción activa.');

    const suscripcion = this.susRepo.create({
      suscriptor,
      membresia,
      estatus: dto.estatus ?? 'activa',
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : null,
      proximaFechaCorte: dto.proximaFechaCorte ? new Date(dto.proximaFechaCorte) : null,
      renovacionAutomatica: !!dto.renovacionAutomatica,
      proveedorPago: dto.proveedorPago ?? null,
      proveedorSuscripcionId: dto.proveedorSuscripcionId ?? null,
    });

    const saved = await this.susRepo.save(suscripcion);

    // abre ciclo actual inmediatamente (para que ya haya balance)
    await this.obtenerOCrearCicloActual(saved);

    return saved;
  }

  private calcularCuota(max: number, extra: number, usados: number): ResumenCuota {
    const disponibles = Math.max(0, (max || 0) + (extra || 0) - (usados || 0));
    return { max: max || 0, extra: extra || 0, usados: usados || 0, disponibles };
  }

  private calcularRangoCiclo(fecha: Date, reset: 'mensual' | 'anual' | 'una_vez') {
    const y = fecha.getFullYear();
    const m = fecha.getMonth(); // 0-11

    if (reset === 'anual') {
      const inicio = new Date(Date.UTC(y, 0, 1));
      const fin = new Date(Date.UTC(y, 11, 31));
      return { inicio: this.soloFecha(inicio), fin: this.soloFecha(fin) };
    }

    if (reset === 'una_vez') {
      const inicio = new Date(Date.UTC(y, 0, 1));
      const fin = new Date(Date.UTC(2099, 11, 31));
      return { inicio: this.soloFecha(inicio), fin: this.soloFecha(fin) };
    }

    // mensual (default)
    const inicio = new Date(Date.UTC(y, m, 1));
    const fin = new Date(Date.UTC(y, m + 1, 0)); // último día del mes
    return { inicio: this.soloFecha(inicio), fin: this.soloFecha(fin) };
  }

  private soloFecha(d: Date): Date {
    // evita hora local; guarda solo fecha (UTC) para que no "brinque" por TZ
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }



  async crearMovimientoEstadoCuenta(dto: CrearEstadoCuentaMovimientoDto) {
  const runner = this.dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    // 1) validar suscriptor
    const suscriptor = await runner.manager.findOne(Suscriptor, {
      where: { id: dto.suscriptorId },
      select: ['id'] as any,
    });

    if (!suscriptor) {
      throw new NotFoundException(`Suscriptor no existe: id=${dto.suscriptorId}`);
    }

    const cargo = Number(dto.cargoCentavos || 0);
    const abono = Number(dto.abonoCentavos || 0);

    // 2) validación de negocio (producción)
    // Regla: al menos uno > 0
    if (cargo <= 0 && abono <= 0) {
      throw new BadRequestException('Debes enviar cargoCentavos o abonoCentavos mayor a 0.');
    }
    // Regla: no permitir ambos > 0 a la vez (evita ambigüedad)
    if (cargo > 0 && abono > 0) {
      throw new BadRequestException('Envía solo cargoCentavos o solo abonoCentavos, no ambos.');
    }

    // 3) lock del "saldo" por suscriptor (bloqueamos el último movimiento)
    // Esto evita que dos requests simultáneos calculen el mismo saldo.
    const ecmRepoTx = runner.manager.getRepository(EstadoCuentaMovimiento);

    const ultimo = await ecmRepoTx
      .createQueryBuilder('m')
      .setLock('pessimistic_write')
      .where('m.suscriptor_id = :suscriptorId', { suscriptorId: dto.suscriptorId })
      .orderBy('m.fecha_creacion', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .getOne();

    const saldoAnterior = ultimo ? Number(ultimo.saldoDespuesCentavos || 0) : 0;

    // 4) cálculo saldo nuevo
    // cargo resta, abono suma
    const saldoNuevo = saldoAnterior - cargo + abono;

    // 5) crear movimiento
    const movimiento = ecmRepoTx.create({
      suscriptorId: dto.suscriptorId,
      suscriptor: { id: dto.suscriptorId } as any,
      tipoMovimiento: dto.tipoMovimiento,
      descripcion: dto.descripcion,
      referenciaTabla: dto.referenciaTabla ?? null,
      referenciaId: dto.referenciaId ?? null,
      cargoCentavos: cargo,
      abonoCentavos: abono,
      saldoDespuesCentavos: saldoNuevo,
      moneda: dto.moneda ?? 'MXN',
    });

    const saved = await ecmRepoTx.save(movimiento);

    await runner.commitTransaction();

    return {
      ok: true,
      movimiento: {
        id: Number(saved.id),
        suscriptorId: saved.suscriptorId,
        tipoMovimiento: saved.tipoMovimiento,
        descripcion: saved.descripcion,
        referenciaTabla: saved.referenciaTabla ?? null,
        referenciaId: saved.referenciaId ?? null,
        cargoCentavos: saved.cargoCentavos,
        abonoCentavos: saved.abonoCentavos,
        saldoDespuesCentavos: saved.saldoDespuesCentavos,
        moneda: saved.moneda,
        fechaCreacion: saved.fechaCreacion,
      },
    };
  } catch (e) {
    await runner.rollbackTransaction();
    throw e;
  } finally {
    await runner.release();
  }
}




  async cambiarPlan(dto: {
    suscriptorId: number;
    nuevaMembresiaId: number;
    fechaInicio: string;
    proximaFechaCorte?: string;
    renovacionAutomatica?: boolean;
    motivo?: string;
  }) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();

    try {
      const suscriptor = await runner.manager.findOne(Suscriptor, { where: { id: dto.suscriptorId } });
      if (!suscriptor) throw new NotFoundException(`Suscriptor no existe: id=${dto.suscriptorId}`);

      const nuevaMembresia = await runner.manager.findOne(Membresia, { where: { id: dto.nuevaMembresiaId } });
      if (!nuevaMembresia) throw new NotFoundException(`Membresía no existe: id=${dto.nuevaMembresiaId}`);

      const activa = await runner.manager.findOne(SuscriptorSuscripcion, {
        where: { suscriptor: { id: dto.suscriptorId } as any, estatus: 'activa' },
        order: { id: 'DESC' },
        relations: { suscriptor: true } as any,
      });

      if (activa) {
        activa.estatus = 'cancelada';
        activa.fechaFin = new Date(); // hoy
        await runner.manager.save(SuscriptorSuscripcion, activa);
      }

      const nueva = runner.manager.create(SuscriptorSuscripcion, {
        suscriptor,
        membresia: nuevaMembresia,
        estatus: 'activa',
        fechaInicio: new Date(dto.fechaInicio),
        proximaFechaCorte: dto.proximaFechaCorte ? new Date(dto.proximaFechaCorte) : null,
        renovacionAutomatica: !!dto.renovacionAutomatica,
      });

      const saved = await runner.manager.save(SuscriptorSuscripcion, nueva);

      // crear ciclo actual idempotente
      const cuotas = await runner.manager.findOne(MembresiaCuotas, {
        where: { membresia: { id: nuevaMembresia.id } as any },
      });
      if (!cuotas) throw new NotFoundException(`No existe configuración de cuotas para membresia_id=${nuevaMembresia.id}`);

      const hoy = new Date();
      const { inicio, fin } = this.calcularRangoCiclo(hoy, cuotas.resetPeriodo as any);

      await this.obtenerOCrearCicloActualLockeado({
        runner,
        suscripcionId: saved.id,
        cicloInicio: inicio,
        cicloFin: fin,
      });

      await runner.commitTransaction();

      return {
        ok: true,
        suscriptorId: dto.suscriptorId,
        suscripcionCanceladaId: activa?.id ?? null,
        nuevaSuscripcionId: saved.id,
      };
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }

  /**
   * CONSUME 1 CUPO de la cuota indicada.
   * - Atomiza con transacción
   * - Bloquea el registro del ciclo para evitar doble consumo concurrente
   */
async consumirCuota(params: {
  suscriptorId: number;
  tipo: 'negocios' | 'promociones' | 'anuncios';
}) {
  const runner = this.dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();

  try {
    // 1) suscripción activa (LOCK FOR UPDATE)
    // Importante: bloquea la fila para evitar inconsistencias si al mismo tiempo cambian plan.
    const susRepoTx = runner.manager.getRepository(SuscriptorSuscripcion);

    const suscripcion = await susRepoTx
      .createQueryBuilder('s')
      .setLock('pessimistic_write')
      .leftJoinAndSelect('s.membresia', 'm') // necesitamos membresia para anunciosIlimitados/anunciosMensuales
      .where('s.suscriptor_id = :suscriptorId', { suscriptorId: params.suscriptorId })
      .andWhere('s.estatus = :estatus', { estatus: 'activa' })
      .orderBy('s.id', 'DESC')
      .getOne();

    if (!suscripcion) {
      throw new NotFoundException(
        `No se encontró suscripción activa para suscriptor_id=${params.suscriptorId}`,
      );
    }

    // 2) cuotas de la membresía (sin joins)
    const cuotas = await runner.manager.findOne(MembresiaCuotas, {
      where: { membresia: { id: suscripcion.membresia.id } as any },
    });

    if (!cuotas) {
      throw new BadRequestException(
        `La membresía ${suscripcion.membresia.id} no tiene cuotas configuradas (membresia_cuotas).`,
      );
    }

    // 3) ciclo actual (idempotente + lock)
    const hoy = new Date();
    const { inicio, fin } = this.calcularRangoCiclo(hoy, cuotas.resetPeriodo as any);

    const ciclo = await this.obtenerOCrearCicloActualLockeado({
      runner,
      suscripcionId: Number(suscripcion.id), // bigint puede venir string
      cicloInicio: inicio,
      cicloFin: fin,
    });

    // 4) cálculo de límite + disponibles
    const limite = this.obtenerLimitePorTipo(params.tipo, suscripcion, cuotas);
    const usados = this.obtenerUsadosPorTipo(params.tipo, ciclo);
    const extra = this.obtenerExtraPorTipo(params.tipo, ciclo);

    const disponibles = Math.max(0, limite + extra - usados);

    if (disponibles <= 0) {
      throw new ConflictException(
        `Límite alcanzado para ${params.tipo}. Disponible=0 (limite=${limite}, extra=${extra}, usados=${usados}).`,
      );
    }

    // 5) consumir
    this.incrementarUsadosPorTipo(params.tipo, ciclo);

    await runner.manager.getRepository(SuscripcionCiclo).save(ciclo);

    await runner.commitTransaction();

    return {
      ok: true,
      suscriptorId: params.suscriptorId,
      suscripcionId: Number(suscripcion.id),
      cicloId: Number(ciclo.id),
      tipo: params.tipo,
      limite,
      extra,
      usadosDespues: this.obtenerUsadosPorTipo(params.tipo, ciclo),
      disponiblesDespues: Math.max(
        0,
        limite + extra - this.obtenerUsadosPorTipo(params.tipo, ciclo),
      ),
    };
  } catch (e) {
    console.error('ERROR consumirCuota =>', e);
    await runner.rollbackTransaction();
    throw e;
  } finally {
    await runner.release();
  }
}

  /**
   * GET-or-CREATE ciclo actual, con lock y UPSERT idempotente.
   * Esto evita el Duplicate entry del uq_ciclo_unico en concurrencia.
   */
  private async obtenerOCrearCicloActualLockeado(params: {
    runner: any;
    suscripcionId: number;
    cicloInicio: Date;
    cicloFin: Date;
  }): Promise<SuscripcionCiclo> {
    const { runner, suscripcionId, cicloInicio, cicloFin } = params;

    const ciclosRepo = runner.manager.getRepository(SuscripcionCiclo);

    const inicioSql = this.formatearFechaSQL(cicloInicio);
    const finSql = this.formatearFechaSQL(cicloFin);

    // 1) intentar leer con lock
    let ciclo = await ciclosRepo
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.suscripcion_id = :suscripcionId', { suscripcionId })
      .andWhere('c.ciclo_inicio = :inicio', { inicio: inicioSql })
      .andWhere('c.ciclo_fin = :fin', { fin: finSql })
      .getOne();

    if (ciclo) return ciclo;

    // 2) crear idempotente (si otro proceso lo creó, no truena)
    await runner.query(
      `
      INSERT INTO suscripcion_ciclos
        (suscripcion_id, ciclo_inicio, ciclo_fin,
         negocios_usados, promociones_usadas, anuncios_usados,
         negocios_extra, promociones_extra, anuncios_extra,
         fecha_creacion)
      VALUES
        (?, ?, ?, 0, 0, 0, 0, 0, 0, NOW())
      ON DUPLICATE KEY UPDATE
        id = id
      `,
      [suscripcionId, inicioSql, finSql],
    );

    // 3) leer otra vez con lock
    ciclo = await ciclosRepo
      .createQueryBuilder('c')
      .setLock('pessimistic_write')
      .where('c.suscripcion_id = :suscripcionId', { suscripcionId })
      .andWhere('c.ciclo_inicio = :inicio', { inicio: inicioSql })
      .andWhere('c.ciclo_fin = :fin', { fin: finSql })
      .getOne();

    if (!ciclo) throw new Error('No se pudo obtener el ciclo actual después del upsert+lock.');

    return ciclo;
  }

  /**
   * Convierte Date -> 'YYYY-MM-DD' (UTC) para comparar columnas DATE.
   */
  private formatearFechaSQL(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ===============================
  // Helpers (NO tocan DB)
  // ===============================

  private obtenerLimitePorTipo(
    tipo: 'negocios' | 'promociones' | 'anuncios',
    suscripcion: SuscriptorSuscripcion,
    cuotas: MembresiaCuotas,
  ): number {
    if (tipo === 'negocios') return cuotas.maxNegocios || 0;
    if (tipo === 'promociones') return cuotas.maxPromociones || 0;

    // anuncios:
    if (suscripcion.membresia.anunciosIlimitados) return 1_000_000_000;

    const desdeMembresia = Number(suscripcion.membresia.anunciosMensuales || 0);
    const desdeCuotas = Number(cuotas.maxAnuncios || 0);

    return desdeCuotas > 0 ? desdeCuotas : desdeMembresia;
  }

  private obtenerUsadosPorTipo(
    tipo: 'negocios' | 'promociones' | 'anuncios',
    ciclo: SuscripcionCiclo,
  ): number {
    if (tipo === 'negocios') return ciclo.negociosUsados || 0;
    if (tipo === 'promociones') return ciclo.promocionesUsadas || 0;
    return ciclo.anunciosUsados || 0;
  }

  private obtenerExtraPorTipo(
    tipo: 'negocios' | 'promociones' | 'anuncios',
    ciclo: SuscripcionCiclo,
  ): number {
    if (tipo === 'negocios') return ciclo.negociosExtra || 0;
    if (tipo === 'promociones') return ciclo.promocionesExtra || 0;
    return ciclo.anunciosExtra || 0;
  }

  private incrementarUsadosPorTipo(
    tipo: 'negocios' | 'promociones' | 'anuncios',
    ciclo: SuscripcionCiclo,
  ) {
    if (tipo === 'negocios') ciclo.negociosUsados = (ciclo.negociosUsados || 0) + 1;
    else if (tipo === 'promociones') ciclo.promocionesUsadas = (ciclo.promocionesUsadas || 0) + 1;
    else ciclo.anunciosUsados = (ciclo.anunciosUsados || 0) + 1;
  }

  // =============================================
  // CUOTAS DE MEMBRESÍA
  // =============================================

  async listarCuotas(): Promise<MembresiaCuotas[]> {
    return this.cuotasRepo.find({ order: { id: 'ASC' } });
  }

  async obtenerCuotasPorMembresia(membresiaId: number): Promise<MembresiaCuotas> {
    const cuotas = await this.cuotasRepo.findOne({
      where: { membresia: { id: membresiaId } as any },
    });
    if (!cuotas) throw new NotFoundException(`No hay cuotas configuradas para membresia_id=${membresiaId}`);
    return cuotas;
  }

  async upsertCuotas(dto: UpsertMembresiaCuotasDto): Promise<MembresiaCuotas> {
    const membresia = await this.membresiasRepo.findOne({ where: { id: dto.membresiaId } });
    if (!membresia) throw new NotFoundException(`Membresía no existe: id=${dto.membresiaId}`);

    let cuotas = await this.cuotasRepo.findOne({
      where: { membresia: { id: dto.membresiaId } as any },
    });

    if (!cuotas) {
      cuotas = this.cuotasRepo.create({ membresia });
    }

    if (dto.maxNegocios !== undefined) cuotas.maxNegocios = dto.maxNegocios;
    if (dto.maxPromociones !== undefined) cuotas.maxPromociones = dto.maxPromociones;
    if (dto.maxAnuncios !== undefined) cuotas.maxAnuncios = dto.maxAnuncios;
    if (dto.resetPeriodo !== undefined) cuotas.resetPeriodo = dto.resetPeriodo;
    if (dto.permitePromosDestacadas !== undefined) cuotas.permitePromosDestacadas = dto.permitePromosDestacadas;
    if (dto.permiteAnunciosPremium !== undefined) cuotas.permiteAnunciosPremium = dto.permiteAnunciosPremium;

    return this.cuotasRepo.save(cuotas);
  }

  // =============================================
  // CANCELAR SUSCRIPCIÓN
  // =============================================

  async cancelarSuscripcion(
    suscripcionId: number,
    requester?: { sub: number; isAdmin: boolean },
  ): Promise<SuscriptorSuscripcion> {
    const suscripcion = await this.susRepo.findOne({
      where: { id: suscripcionId },
      relations: ['suscriptor'],
    });
    if (!suscripcion) throw new NotFoundException(`Suscripción no existe: id=${suscripcionId}`);

    // JLP-C: verificación de propiedad — un usuario solo cancela su propia suscripción.
    // requester se omite en llamadas internas (server-to-server) que ya son de confianza.
    if (requester && !requester.isAdmin) {
      const ownerId = Number(suscripcion.suscriptor?.id);
      if (!requester.sub || ownerId !== Number(requester.sub)) {
        throw new ForbiddenException('Solo puedes cancelar tu propia suscripción.');
      }
    }

    if (suscripcion.estatus === 'cancelada') throw new BadRequestException('La suscripción ya está cancelada.');

    suscripcion.estatus = 'cancelada';
    suscripcion.fechaFin = new Date();
    return this.susRepo.save(suscripcion);
  }
}