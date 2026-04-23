import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PromocionSucursal } from './entities/promocion-sucursal.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { CreatePromocionSucursalDto } from './dto/create-promocion-sucursal.dto';
import { UpdatePromocionSucursalDto } from './dto/update-promocion-sucursal.dto';
import { EventosNegociosService } from '../eventos_negocios/eventos-negocios.service';

@Injectable()
export class PromocionesSucursalesService {
  constructor(
    @InjectRepository(PromocionSucursal)
    private readonly promoRepo: Repository<PromocionSucursal>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    private readonly eventosNegociosService: EventosNegociosService,
  ) {}

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
  // CREATE
  // =========================================================
  async crear(dto: CreatePromocionSucursalDto): Promise<PromocionSucursal> {
    const sucursalId = Number(dto.sucursalId);

    if (!Number.isFinite(sucursalId) || sucursalId <= 0) {
      throw new BadRequestException('sucursalId inválido.');
    }

    const sucursal = await this.sucursalRepo.findOne({
      where: { id: sucursalId },
      relations: ['negocio'],
    });

    if (!sucursal) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const diasVigenciaNormalizados = this.normalizeDiasVigencia(dto.diasVigencia);

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

    return promoGuardada;
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
  async actualizar(id: number, dto: UpdatePromocionSucursalDto): Promise<PromocionSucursal> {
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
  async eliminar(id: number): Promise<PromocionSucursal> {
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
}