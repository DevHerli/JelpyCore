import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { PromocionSucursal } from './entities/promocion-sucursal.entity';
import { PromocionEvento } from './entities/promocion-evento.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { CreatePromocionSucursalDto } from './dto/create-promocion-sucursal.dto';
import { UpdatePromocionSucursalDto } from './dto/update-promocion-sucursal.dto';
import { TrackPromocionEventoDto } from './dto/track-promocion-evento.dto';
import { EventosNegociosService } from '../eventos_negocios/eventos-negocios.service';

/** Identidad del solicitante para verificación de propiedad (JLP-C11). */
export type RequesterCtx = { sub: number; isAdmin: boolean };

@Injectable()
export class PromocionesSucursalesService {
  constructor(
    @InjectRepository(PromocionSucursal)
    private readonly promoRepo: Repository<PromocionSucursal>,

    @InjectRepository(PromocionEvento)
    private readonly promoEventoRepo: Repository<PromocionEvento>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    private readonly eventosNegociosService: EventosNegociosService,
  ) {}

  // =========================================================
  // PROPIEDAD (JLP-C11) — una promoción de sucursal pertenece a una
  // sucursal, cuyo negocio tiene un suscriptor dueño. Sólo el dueño
  // (o admin) puede crear/editar/eliminar.
  // =========================================================

  /** Verifica que el solicitante sea dueño de una sucursal ya cargada (con negocio.suscriptor). */
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

  /** Público: verifica propiedad por id de promoción (usado por el controller antes de Cloudinary). */
  async assertPuedeGestionarPromocion(
    promoId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester || requester.isAdmin) return;
    const promo = await this.promoRepo.findOne({
      where: { id: Number(promoId), eliminado: false },
      relations: ['sucursal', 'sucursal.negocio', 'sucursal.negocio.suscriptor'],
    });
    if (!promo) throw new NotFoundException('Promoción no encontrada');
    this.assertOwnerOfSucursal(promo.sucursal, requester);
  }

  // =========================================================
  // HELPERS
  // =========================================================
  private normalizeDiasVigencia(value?: string | string[] | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (Array.isArray(value)) {
      const dias = value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);

      return dias.length ? dias.join(',') : null;
    }

    const limpio = String(value).trim();
    return limpio.length ? limpio : null;
  }

  private async registrarEventoPromocionSucursal(params: {
    tipoEvento: 'promocion_sucursal_creada' | 'promocion_sucursal_actualizada' | 'promocion_sucursal_eliminada';
    negocioId: number;
    sucursalId: number;
    promocionId: number;
    tituloPromocion: string;
    nombreSucursal?: string | null;
    descripcion?: string | null;
    tipoPromocion?: string | null;
    valorDescuento?: number | null;
    fechaInicio?: any;
    fechaFin?: any;
    imagenUrl?: string | null;
  }) {
    const {
      tipoEvento,
      negocioId,
      sucursalId,
      promocionId,
      tituloPromocion,
      nombreSucursal,
      descripcion,
      tipoPromocion,
      valorDescuento,
      fechaInicio,
      fechaFin,
      imagenUrl,
    } = params;

    let tituloEvento = '';
    let descripcionEvento = '';

    if (tipoEvento === 'promocion_sucursal_creada') {
      tituloEvento = 'Nueva promoción en sucursal';
      descripcionEvento =
        tituloPromocion || `La sucursal ${nombreSucursal ?? ''} publicó una promoción.`;
    }

    if (tipoEvento === 'promocion_sucursal_actualizada') {
      tituloEvento = 'Promoción de sucursal actualizada';
      descripcionEvento =
        tituloPromocion || `La sucursal ${nombreSucursal ?? ''} actualizó una promoción.`;
    }

    if (tipoEvento === 'promocion_sucursal_eliminada') {
      tituloEvento = 'Promoción de sucursal finalizada';
      descripcionEvento =
        tituloPromocion || `La sucursal ${nombreSucursal ?? ''} retiró una promoción.`;
    }

    await this.eventosNegociosService.crear({
      negocioId,
      sucursalId,
      tipoEvento,
      titulo: tituloEvento,
      descripcion: descripcionEvento,
      visibleParaFavoritos: true,
      activo: true,
      payload: {
        promocionSucursalId: promocionId,
        tituloPromocion,
        nombreSucursal: nombreSucursal ?? null,
        descripcionPromocion: descripcion ?? null,
        tipoPromocion: tipoPromocion ?? null,
        valorDescuento: valorDescuento ?? null,
        fechaInicio: fechaInicio ?? null,
        fechaFin: fechaFin ?? null,
        imagenUrl: imagenUrl ?? null,
      },
    });
  }

  // =========================================================
  // ALCANCE (una sucursal / varias / todo el negocio)
  // =========================================================
  /**
   * Resuelve el conjunto de sucursales destino de una creación:
   *  - Por defecto: sólo `dto.sucursalId` (comportamiento histórico).
   *  - `dto.aplicarATodas === true`: todas las sucursales activas del
   *    negocio dueño de `dto.sucursalId`.
   *  - `dto.sucursalIds` con elementos: `dto.sucursalId` + esas sucursales
   *    (deben pertenecer al mismo negocio que la sucursal ancla).
   * Verifica propiedad de CADA sucursal resultante antes de devolverlas.
   */
  private async resolveTargetSucursales(
    dto: CreatePromocionSucursalDto,
    requester?: RequesterCtx,
  ): Promise<SucursalNegocio[]> {
    const anchorId = Number(dto.sucursalId);

    if (!Number.isFinite(anchorId) || anchorId <= 0) {
      throw new BadRequestException('sucursalId inválido.');
    }

    const anchor = await this.sucursalRepo.findOne({
      where: { id: anchorId },
      relations: ['negocio', 'negocio.suscriptor'],
    });

    if (!anchor) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    this.assertOwnerOfSucursal(anchor, requester);

    const negocioId = Number(anchor.negocio?.id);

    if (dto.aplicarATodas) {
      const todas = await this.sucursalRepo.find({
        where: { negocio: { id: negocioId } as any, eliminado: false },
        relations: ['negocio', 'negocio.suscriptor'],
      });

      return todas.length ? todas : [anchor];
    }

    if (Array.isArray(dto.sucursalIds) && dto.sucursalIds.length > 0) {
      const idsUnicos = Array.from(
        new Set<number>([anchorId, ...dto.sucursalIds.map((id) => Number(id))]),
      );

      const seleccionadas = await this.sucursalRepo.find({
        where: { id: In(idsUnicos), eliminado: false },
        relations: ['negocio', 'negocio.suscriptor'],
      });

      const fueraDeNegocio = seleccionadas.filter(
        (s) => Number(s.negocio?.id) !== negocioId,
      );

      if (fueraDeNegocio.length > 0) {
        throw new ForbiddenException(
          'Todas las sucursales seleccionadas deben pertenecer al mismo negocio.',
        );
      }

      seleccionadas.forEach((s) => this.assertOwnerOfSucursal(s, requester));

      return seleccionadas.length ? seleccionadas : [anchor];
    }

    return [anchor];
  }

  // =========================================================
  // CREATE
  // =========================================================
  /**
   * Si el alcance resuelto es una sola sucursal devuelve la promoción tal
   * cual (compatibilidad con el comportamiento histórico). Si son 2+
   * sucursales, crea una fila por sucursal —todas compartiendo un
   * `loteGlobalId` y `origen: 'BUSINESS'`— y devuelve un resumen del lote.
   */
  async crear(
    dto: CreatePromocionSucursalDto,
    requester?: RequesterCtx,
  ): Promise<
    | PromocionSucursal
    | { loteGlobalId: string; origen: 'BUSINESS'; total: number; promociones: PromocionSucursal[] }
  > {
    const targets = await this.resolveTargetSucursales(dto, requester);
    const esLote = targets.length > 1;
    const loteGlobalId = esLote ? randomUUID() : null;
    const diasVigenciaNormalizados = this.normalizeDiasVigencia(dto.diasVigencia);

    const promociones: PromocionSucursal[] = [];

    for (const sucursal of targets) {
      const nuevaPromo = this.promoRepo.create({
        titulo: dto.titulo?.trim(),
        descripcion: dto.descripcion ?? null,
        tipoPromocion: dto.tipoPromocion,
        valorDescuento: dto.valorDescuento ?? null,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin,
        diasVigencia: diasVigenciaNormalizados,
        horaInicio: dto.horaInicio ?? null,
        horaFin: dto.horaFin ?? null,
        condiciones: dto.condiciones ?? null,
        imagenUrl: dto.imagenUrl ?? null,
        activa: dto.activa ?? true,
        eliminado: false,
        origen: esLote ? 'BUSINESS' : 'BRANCH',
        loteGlobalId,
        sucursal,
      });

      const promoGuardada = await this.promoRepo.save(nuevaPromo);

      await this.registrarEventoPromocionSucursal({
        tipoEvento: 'promocion_sucursal_creada',
        negocioId: Number(sucursal.negocio.id),
        sucursalId: Number(sucursal.id),
        promocionId: Number(promoGuardada.id),
        tituloPromocion: promoGuardada.titulo,
        nombreSucursal: sucursal.nombreSucursal,
        descripcion: promoGuardada.descripcion,
        tipoPromocion: promoGuardada.tipoPromocion,
        valorDescuento: promoGuardada.valorDescuento,
        fechaInicio: promoGuardada.fechaInicio,
        fechaFin: promoGuardada.fechaFin,
        imagenUrl: promoGuardada.imagenUrl,
      });

      promociones.push(promoGuardada);
    }

    if (!esLote) {
      return promociones[0];
    }

    return {
      loteGlobalId: loteGlobalId as string,
      origen: 'BUSINESS',
      total: promociones.length,
      promociones,
    };
  }

  // =========================================================
  // GET ALL
  // =========================================================
  async listar(): Promise<PromocionSucursal[]> {
    return this.promoRepo.find({
      where: { eliminado: false },
      relations: ['sucursal', 'sucursal.negocio'],
      order: { fechaInicio: 'DESC' },
    });
  }

  // =========================================================
  // GET ONE INTERNO PARA UPDATE CON CLOUDINARY
  // =========================================================
  async buscarPorId(id: number): Promise<PromocionSucursal> {
    const promoId = Number(id);

    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
      relations: ['sucursal', 'sucursal.negocio'],
    });

    if (!promo) {
      throw new NotFoundException('Promoción no encontrada');
    }

    return promo;
  }

  // =========================================================
  // GET ONE PARA CONTROLLER
  // =========================================================
  async obtenerPorId(id: number): Promise<PromocionSucursal> {
    const promoId = Number(id);

    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
      relations: ['sucursal', 'sucursal.negocio'],
    });

    if (!promo) {
      throw new NotFoundException('Promoción no encontrada');
    }

    return promo;
  }

  // =========================================================
  // GET BY BRANCH
  // =========================================================
  async listarPorSucursal(sucursalId: number): Promise<PromocionSucursal[]> {
    const branchId = Number(sucursalId);

    if (!Number.isFinite(branchId) || branchId <= 0) {
      throw new BadRequestException('sucursalId inválido.');
    }

    return this.promoRepo.find({
      where: { sucursal: { id: branchId }, eliminado: false },
      relations: ['sucursal', 'sucursal.negocio'],
      order: { fechaInicio: 'DESC' },
    });
  }

  // =========================================================
  // GET ACTIVAS
  // =========================================================
  async listarPromocionesActivas(ciudadId?: number): Promise<PromocionSucursal[]> {
    const hoy = new Date();
    const diaActual = hoy
      .toLocaleString('es-MX', { weekday: 'long' })
      .replace(/^\w/, (c) => c.toUpperCase());

    const query = this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
      .andWhere(
        '(promo.dias_vigencia IS NULL OR promo.dias_vigencia = "" OR FIND_IN_SET(:dia, promo.dias_vigencia) > 0)',
        { dia: diaActual },
      );

    if (ciudadId) {
      query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    return query.orderBy('promo.fecha_inicio', 'DESC').getMany();
  }

  async listarPromocionesVigentes(ciudadId?: number): Promise<PromocionSucursal[]> {
    const query = this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin');

    if (ciudadId) {
      query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    return query.orderBy('promo.fecha_inicio', 'DESC').addOrderBy('promo.id', 'DESC').getMany();
  }

  // =========================================================
  // GET ACTIVAS FILTRADAS
  // =========================================================
  async listarPromocionesActivasFiltradas(
    ciudadId?: number,
    categoriaId?: number,
    subcategoriaId?: number,
  ): Promise<PromocionSucursal[]> {
    const hoy = new Date();
    const diaActual = hoy
      .toLocaleString('es-MX', { weekday: 'long' })
      .replace(/^\w/, (c) => c.toUpperCase());

    const query = this.promoRepo
      .createQueryBuilder('promo')
      .distinct(true)
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
      .andWhere(
        '(promo.dias_vigencia IS NULL OR promo.dias_vigencia = "" OR FIND_IN_SET(:dia, promo.dias_vigencia) > 0)',
        { dia: diaActual },
      );

    if (ciudadId) query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    if (categoriaId) query.andWhere('categoria.id = :categoriaId', { categoriaId });
    if (subcategoriaId) query.andWhere('subcategoria.id = :subcategoriaId', { subcategoriaId });

    return query.orderBy('promo.fecha_inicio', 'DESC').getMany();
  }

  async buscarPromocionesActivasPorTexto(
    texto: string,
    ciudadId?: number,
  ): Promise<PromocionSucursal[]> {
    const termino = String(texto || '').trim().toLowerCase();

    if (!termino) return [];

    const hoy = new Date();
    const diaActual = hoy
      .toLocaleString('es-MX', { weekday: 'long' })
      .replace(/^\w/, (c) => c.toUpperCase());

    const query = this.promoRepo
      .createQueryBuilder('promo')
      .distinct(true)
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
      .leftJoin('items_negocio', 'item', 'item.negocio_id = negocio.id AND item.activo = 1')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
      .andWhere(
        `(
          LOWER(promo.titulo) LIKE :termino OR
          LOWER(COALESCE(promo.descripcion, '')) LIKE :termino OR
          LOWER(negocio.nombre_negocio) LIKE :termino OR
          LOWER(COALESCE(categoria.nombre, '')) LIKE :termino OR
          LOWER(COALESCE(subcategoria.nombre, '')) LIKE :termino OR
          LOWER(COALESCE(item.nombre, '')) LIKE :termino OR
          LOWER(COALESCE(item.descripcion, '')) LIKE :termino
        )`,
        { termino: `%${termino}%` },
      );

    if (ciudadId) {
      query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    return query
      .orderBy('promo.fecha_inicio', 'DESC')
      .addOrderBy('promo.id', 'DESC')
      .limit(10)
      .getMany();
  }

  // =========================================================
  // GET PRÓXIMAS
  // =========================================================
  async listarPromocionesProximas(
    ciudadId?: number,
    categoriaId?: number,
    subcategoriaId?: number,
  ): Promise<PromocionSucursal[]> {
    const query = this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('promo.fecha_inicio > CURDATE()');

    if (ciudadId) query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    if (categoriaId) query.andWhere('categoria.id = :categoriaId', { categoriaId });
    if (subcategoriaId) query.andWhere('subcategoria.id = :subcategoriaId', { subcategoriaId });

    return query.orderBy('promo.fecha_inicio', 'ASC').getMany();
  }

  // =========================================================
  // GET FINALIZADAS
  // =========================================================
  async listarPromocionesFinalizadas(
    ciudadId?: number,
    categoriaId?: number,
    subcategoriaId?: number,
  ): Promise<PromocionSucursal[]> {
    const query = this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .where('promo.eliminado = 0')
      .andWhere('promo.fecha_fin < CURDATE()');

    if (ciudadId) query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    if (categoriaId) query.andWhere('categoria.id = :categoriaId', { categoriaId });
    if (subcategoriaId) query.andWhere('subcategoria.id = :subcategoriaId', { subcategoriaId });

    return query.orderBy('promo.fecha_fin', 'DESC').getMany();
  }

  // =========================================================
  // RESUMEN
  // =========================================================
  async obtenerResumenPromociones(): Promise<any> {
    const hoy = new Date();

    const fechaLimite = new Date();
    fechaLimite.setDate(hoy.getDate() + 3);

    const totalActivas = await this.promoRepo
      .createQueryBuilder('promo')
      .where('promo.activa = 1')
      .andWhere('promo.eliminado = 0')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
      .getCount();

    const totalProximas = await this.promoRepo
      .createQueryBuilder('promo')
      .where('promo.activa = 1')
      .andWhere('promo.eliminado = 0')
      .andWhere('promo.fecha_inicio > CURDATE()')
      .getCount();

    const totalFinalizadas = await this.promoRepo
      .createQueryBuilder('promo')
      .where('promo.eliminado = 0')
      .andWhere('promo.fecha_fin < CURDATE()')
      .getCount();

    const proximasAVencer = await this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('promo.fecha_fin BETWEEN CURDATE() AND :fechaLimite', { fechaLimite })
      .orderBy('promo.fecha_fin', 'ASC')
      .getMany();

    const categoriasTop = await this.promoRepo
      .createQueryBuilder('promo')
      .leftJoin('promo.sucursal', 'sucursal')
      .leftJoin('sucursal.negocio', 'negocio')
      .leftJoin('negocio.categoria', 'categoria')
      .select('categoria.nombre', 'categoria')
      .addSelect('COUNT(promo.id)', 'total')
      .where('promo.activa = 1')
      .andWhere('promo.eliminado = 0')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
      .groupBy('categoria.nombre')
      .orderBy('total', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      fechaGeneracion: hoy,
      resumen: {
        activas: totalActivas,
        proximas: totalProximas,
        finalizadas: totalFinalizadas,
      },
      proximasAVencer,
      categoriasDestacadas: categoriasTop,
    };
  }

  // =========================================================
  // ESTADÍSTICAS
  // =========================================================
  async obtenerEstadisticasPromociones(): Promise<any> {
    const totales = await this.promoRepo.query(`
      SELECT 
        SUM(vistas) AS totalVistas,
        SUM(clics) AS totalClics,
        ROUND(SUM(clics) / NULLIF(SUM(vistas), 0) * 100, 2) AS eficiencia
      FROM estadisticas_promociones
    `);

    const masVistas = await this.promoRepo.query(`
      SELECT 
        p.id,
        p.titulo,
        s.nombre_sucursal AS sucursal,
        n.nombre_negocio AS negocio,
        e.vistas
      FROM estadisticas_promociones e
      INNER JOIN promociones_sucursales p ON e.promocion_id = p.id
      INNER JOIN sucursales_negocios s ON p.sucursal_id = s.id
      INNER JOIN negocios n ON s.negocio_id = n.id
      ORDER BY e.vistas DESC
      LIMIT 5
    `);

    const masClics = await this.promoRepo.query(`
      SELECT 
        p.id,
        p.titulo,
        s.nombre_sucursal AS sucursal,
        n.nombre_negocio AS negocio,
        e.clics
      FROM estadisticas_promociones e
      INNER JOIN promociones_sucursales p ON e.promocion_id = p.id
      INNER JOIN sucursales_negocios s ON p.sucursal_id = s.id
      INNER JOIN negocios n ON s.negocio_id = n.id
      ORDER BY e.clics DESC
      LIMIT 5
    `);

    const sucursalesActivas = await this.promoRepo.query(`
      SELECT 
        s.id,
        s.nombre_sucursal,
        COUNT(p.id) AS totalPromociones
      FROM sucursales_negocios s
      INNER JOIN promociones_sucursales p ON s.id = p.sucursal_id
      WHERE p.eliminado = 0 AND p.activa = 1
      GROUP BY s.id
      ORDER BY totalPromociones DESC
      LIMIT 5
    `);

    return {
      fechaGeneracion: new Date(),
      totales: totales[0],
      top: {
        masVistas,
        masClics,
        sucursalesActivas,
      },
    };
  }

  // =========================================================
  // REGISTRAR VISTA
  // =========================================================
  async registrarVista(promocionId: number): Promise<any> {
    const existe = await this.promoRepo.query(
      `SELECT * FROM estadisticas_promociones WHERE promocion_id = ? LIMIT 1`,
      [promocionId],
    );

    if (existe.length > 0) {
      await this.promoRepo.query(
        `UPDATE estadisticas_promociones SET vistas = vistas + 1 WHERE promocion_id = ?`,
        [promocionId],
      );
    } else {
      await this.promoRepo.query(
        `INSERT INTO estadisticas_promociones (promocion_id, vistas, clics) VALUES (?, 1, 0)`,
        [promocionId],
      );
    }

    return { message: 'Vista registrada correctamente', promocionId };
  }

  // =========================================================
  // REGISTRAR CLIC
  // =========================================================
  async registrarClic(promocionId: number): Promise<any> {
    const existe = await this.promoRepo.query(
      `SELECT * FROM estadisticas_promociones WHERE promocion_id = ? LIMIT 1`,
      [promocionId],
    );

    if (existe.length > 0) {
      await this.promoRepo.query(
        `UPDATE estadisticas_promociones SET clics = clics + 1 WHERE promocion_id = ?`,
        [promocionId],
      );
    } else {
      await this.promoRepo.query(
        `INSERT INTO estadisticas_promociones (promocion_id, vistas, clics) VALUES (?, 0, 1)`,
        [promocionId],
      );
    }

    return { message: 'Clic registrado correctamente', promocionId };
  }

  // =========================================================
  // UPDATE
  // =========================================================
  async actualizar(id: number, dto: UpdatePromocionSucursalDto, requester?: RequesterCtx): Promise<PromocionSucursal> {
    const promoId = Number(id);

    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
      relations: ['sucursal', 'sucursal.negocio', 'sucursal.negocio.suscriptor'],
    });

    if (!promo) {
      throw new NotFoundException('Promoción no encontrada');
    }

    this.assertOwnerOfSucursal(promo.sucursal, requester);

    if (dto.titulo !== undefined) promo.titulo = dto.titulo;
    if (dto.descripcion !== undefined) promo.descripcion = dto.descripcion;
    if (dto.tipoPromocion !== undefined) promo.tipoPromocion = dto.tipoPromocion;
    if (dto.valorDescuento !== undefined) promo.valorDescuento = dto.valorDescuento;
    if (dto.fechaInicio !== undefined) promo.fechaInicio = dto.fechaInicio;
    if (dto.fechaFin !== undefined) promo.fechaFin = dto.fechaFin;

    if (dto.diasVigencia !== undefined) {
      promo.diasVigencia = this.normalizeDiasVigencia(dto.diasVigencia);
    }

    if (dto.horaInicio !== undefined) promo.horaInicio = dto.horaInicio;
    if (dto.horaFin !== undefined) promo.horaFin = dto.horaFin;
    if (dto.condiciones !== undefined) promo.condiciones = dto.condiciones;
    if (dto.imagenUrl !== undefined) promo.imagenUrl = dto.imagenUrl;
    if (dto.activa !== undefined) promo.activa = dto.activa;

    const promoActualizada = await this.promoRepo.save(promo);

    await this.registrarEventoPromocionSucursal({
      tipoEvento: 'promocion_sucursal_actualizada',
      negocioId: Number(promo.sucursal.negocio.id),
      sucursalId: Number(promo.sucursal.id),
      promocionId: Number(promoActualizada.id),
      tituloPromocion: promoActualizada.titulo,
      nombreSucursal: promo.sucursal.nombreSucursal,
      descripcion: promoActualizada.descripcion,
      tipoPromocion: promoActualizada.tipoPromocion,
      valorDescuento: promoActualizada.valorDescuento,
      fechaInicio: promoActualizada.fechaInicio,
      fechaFin: promoActualizada.fechaFin,
      imagenUrl: promoActualizada.imagenUrl,
    });

    return promoActualizada;
  }

  // =========================================================
  // DELETE (SOFT)
  // =========================================================
  async eliminar(id: number, requester?: RequesterCtx): Promise<PromocionSucursal> {
    const promoId = Number(id);

    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
      relations: ['sucursal', 'sucursal.negocio', 'sucursal.negocio.suscriptor'],
    });

    if (!promo) {
      throw new NotFoundException('Promoción no encontrada');
    }

    this.assertOwnerOfSucursal(promo.sucursal, requester);

    promo.eliminado = true;
    promo.activa = false;

    const promoEliminada = await this.promoRepo.save(promo);

    await this.registrarEventoPromocionSucursal({
      tipoEvento: 'promocion_sucursal_eliminada',
      negocioId: Number(promo.sucursal.negocio.id),
      sucursalId: Number(promo.sucursal.id),
      promocionId: Number(promoEliminada.id),
      tituloPromocion: promoEliminada.titulo,
      nombreSucursal: promo.sucursal.nombreSucursal,
      descripcion: promoEliminada.descripcion,
      tipoPromocion: promoEliminada.tipoPromocion,
      valorDescuento: promoEliminada.valorDescuento,
      fechaInicio: promoEliminada.fechaInicio,
      fechaFin: promoEliminada.fechaFin,
      imagenUrl: promoEliminada.imagenUrl,
    });

    return promoEliminada;
  }

  // =========================================================
  // GET BY BUSINESS
  // =========================================================
  async listarPorNegocio(negocioId: number): Promise<PromocionSucursal[]> {
    const businessId = Number(negocioId);

    if (!Number.isFinite(businessId) || businessId <= 0) {
      throw new BadRequestException('negocioId inválido.');
    }

    return this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .where('promo.eliminado = 0')
      .andWhere('negocio.id = :negocioId', { negocioId: businessId })
      .orderBy('promo.fecha_inicio', 'DESC')
      .getMany();
  }

  // =========================================================
  // METRICS-002: TRACKING REAL (vistas / alcance / conversiones)
  // =========================================================

  /**
   * Registra un evento de descubrimiento/interacción con una promoción
   * (vista o conversión). Público/anónimo por diseño (mismo criterio que
   * EstadisticasController.registrarEvento) — se mitiga con Throttle en el
   * controller, no con auth.
   *
   * La categoría/subcategoría/especialidad se resuelven y "fotografían" AQUÍ
   * en el servidor (no se confía en lo que mande el cliente): se derivan de
   * promocion.sucursal.negocio, la única fuente de verdad hoy (la promoción
   * no tiene esa relación directa).
   */
  async registrarEventoPromocion(
    promocionId: number,
    dto: TrackPromocionEventoDto,
  ): Promise<{ message: string; promocionId: number }> {
    const promoId = Number(promocionId);

    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    if (dto.tipoEvento === 'conversion' && !dto.tipoConversion) {
      throw new BadRequestException(
        'tipoConversion es requerido para eventos de conversión.',
      );
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
      relations: [
        'sucursal',
        'sucursal.negocio',
        'sucursal.negocio.categoria',
        'sucursal.negocio.subcategoria',
        'sucursal.negocio.especialidad',
      ],
    });

    if (!promo) {
      throw new NotFoundException('Promoción no encontrada');
    }

    const negocio = promo.sucursal.negocio;
    const now = new Date();

    const evento = this.promoEventoRepo.create({
      promocionId: promo.id,
      sucursalId: Number(promo.sucursal.id),
      negocioId: Number(negocio.id),
      tipoEvento: dto.tipoEvento,
      tipoConversion:
        dto.tipoEvento === 'conversion' ? (dto.tipoConversion ?? null) : null,
      origen: dto.origen ?? 'home',
      categoriaId: (negocio.categoria as any)?.id ?? null,
      subcategoriaId: (negocio.subcategoria as any)?.id ?? null,
      especialidadId: (negocio.especialidad as any)?.id ?? null,
      categoriaNombre: (negocio.categoria as any)?.nombre ?? null,
      subcategoriaNombre: (negocio.subcategoria as any)?.nombre ?? null,
      especialidadNombre: (negocio.especialidad as any)?.nombre ?? null,
      usuarioId: dto.usuarioId ?? null,
      deviceId: dto.deviceId?.trim() || null,
      fecha: this.toLocalDate(now),
      hora: now.getHours(),
      diaSemana: now.getDay(),
    });

    await this.promoEventoRepo.save(evento);

    return { message: 'Evento registrado', promocionId: promo.id };
  }

  /** Métricas reales de UNA sucursal (alimenta app-branch-promotion-section). */
  async obtenerMetricasSucursal(
    sucursalId: number,
    requester?: RequesterCtx,
  ): Promise<any> {
    const branchId = Number(sucursalId);

    if (!Number.isFinite(branchId) || branchId <= 0) {
      throw new BadRequestException('sucursalId inválido.');
    }

    const sucursal = await this.sucursalRepo.findOne({
      where: { id: branchId },
      relations: ['negocio', 'negocio.suscriptor'],
    });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    this.assertOwnerOfSucursal(sucursal, requester);

    return this.calcularMetricas({ sucursalId: branchId });
  }

  /** Métricas reales agregadas de TODAS las sucursales de un negocio (alimenta Promociones Globales). */
  async obtenerMetricasNegocio(
    negocioId: number,
    requester?: RequesterCtx,
  ): Promise<any> {
    const businessId = Number(negocioId);

    if (!Number.isFinite(businessId) || businessId <= 0) {
      throw new BadRequestException('negocioId inválido.');
    }

    await this.assertOwnerOfNegocio(businessId, requester);

    return this.calcularMetricas({ negocioId: businessId });
  }

  /** Verifica propiedad de un negocio directamente (sin pasar por una sucursal ancla). */
  private async assertOwnerOfNegocio(
    negocioId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester || requester.isAdmin) return;

    const rows = await this.promoRepo.query(
      `SELECT suscriptor_id FROM negocios WHERE id = ? LIMIT 1`,
      [negocioId],
    );

    if (!rows.length) {
      throw new NotFoundException('Negocio no encontrado');
    }

    if (Number(rows[0].suscriptor_id) !== Number(requester.sub)) {
      throw new ForbiddenException('No tienes permiso sobre este negocio');
    }
  }

  /**
   * Calcula vistas / alcanzados / conversiones (+ desgloses) a partir de
   * `promociones_eventos`, filtrando por sucursal o por negocio (agregando
   * todas sus sucursales).
   *
   * "Alcanzados" = personas ÚNICAS entre las vistas, identificadas por
   * usuario_id si está logueado, o por device_id (anónimo) si no —
   * COUNT(DISTINCT COALESCE(usuario_id, device_id)).
   */
  private async calcularMetricas(filtro: {
    sucursalId?: number;
    negocioId?: number;
  }): Promise<any> {
    const base = this.promoEventoRepo.createQueryBuilder('ev');

    if (filtro.sucursalId) {
      base.andWhere('ev.sucursalId = :sucursalId', {
        sucursalId: filtro.sucursalId,
      });
    }

    if (filtro.negocioId) {
      base.andWhere('ev.negocioId = :negocioId', {
        negocioId: filtro.negocioId,
      });
    }

    const vistas = await base
      .clone()
      .andWhere("ev.tipoEvento = 'vista'")
      .getCount();

    const alcanzadosRow = await base
      .clone()
      .andWhere("ev.tipoEvento = 'vista'")
      .select(
        'COUNT(DISTINCT COALESCE(ev.usuarioId, ev.deviceId))',
        'total',
      )
      .getRawOne();

    const conversiones = await base
      .clone()
      .andWhere("ev.tipoEvento = 'conversion'")
      .getCount();

    const conversionesPorTipo = await base
      .clone()
      .andWhere("ev.tipoEvento = 'conversion'")
      .select('ev.tipoConversion', 'tipo')
      .addSelect('COUNT(*)', 'total')
      .groupBy('ev.tipoConversion')
      .getRawMany();

    const porOrigen = await base
      .clone()
      .andWhere("ev.tipoEvento = 'vista'")
      .select('ev.origen', 'origen')
      .addSelect('COUNT(*)', 'total')
      .groupBy('ev.origen')
      .getRawMany();

    const porCategoria = await base
      .clone()
      .andWhere("ev.tipoEvento = 'vista'")
      .andWhere('ev.categoriaNombre IS NOT NULL')
      .select('ev.categoriaNombre', 'categoria')
      .addSelect('ev.subcategoriaNombre', 'subcategoria')
      .addSelect('COUNT(*)', 'total')
      .groupBy('ev.categoriaNombre')
      .addGroupBy('ev.subcategoriaNombre')
      .orderBy('total', 'DESC')
      .limit(10)
      .getRawMany();

    const topPromociones = await base
      .clone()
      .andWhere("ev.tipoEvento = 'vista'")
      .select('ev.promocionId', 'promocionId')
      .addSelect('COUNT(*)', 'vistas')
      .groupBy('ev.promocionId')
      .orderBy('vistas', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      vistas,
      alcanzados: Number(alcanzadosRow?.total ?? 0),
      conversiones,
      conversionesPorTipo: conversionesPorTipo.map((r) => ({
        tipo: r.tipo,
        total: Number(r.total),
      })),
      porOrigen: porOrigen.map((r) => ({
        origen: r.origen,
        total: Number(r.total),
      })),
      porCategoria: porCategoria.map((r) => ({
        categoria: r.categoria,
        subcategoria: r.subcategoria,
        total: Number(r.total),
      })),
      topPromociones: topPromociones.map((r) => ({
        promocionId: Number(r.promocionId),
        vistas: Number(r.vistas),
      })),
    };
  }

  private toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
