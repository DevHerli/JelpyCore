import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { PromotionBusiness } from './entities/promotion-business.entity';
import { PromotionBusinessBranch } from './entities/promotion-business-branch.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { Negocio } from '../negocios/entities/negocio.entity';
import { CreatePromotionBusinessDto } from './dtos/create-promotion-business.dto';
import { UpdatePromotionBusinessDto } from './dtos/update-promotion-business.dto';
import { EventosNegociosService } from '../eventos_negocios/eventos-negocios.service';

/** Identidad del solicitante para verificación de propiedad (JLP-C11). */
export type RequesterCtx = { sub: number; isAdmin: boolean };

@Injectable()
export class PromocionesNegociosService {
  constructor(
    @InjectRepository(PromotionBusiness)
    private readonly promoRepo: Repository<PromotionBusiness>,

    @InjectRepository(PromotionBusinessBranch)
    private readonly linkRepo: Repository<PromotionBusinessBranch>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,

    private readonly eventosNegociosService: EventosNegociosService,
  ) {}

  /**
   * JLP-C11 — Una promoción de negocio pertenece a un negocio (businessId),
   * y el negocio tiene un suscriptor dueño. Sólo el dueño (o admin) puede
   * crear/editar/eliminar promociones de ese negocio.
   */
  private async assertOwnershipByNegocio(
    negocioId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester || requester.isAdmin) return;
    const negocio = await this.negocioRepo.findOne({
      where: { id: negocioId },
      relations: ['suscriptor'],
    });
    if (!negocio) throw new NotFoundException('Negocio no encontrado');
    if (!requester.sub || Number(negocio.suscriptor?.id) !== Number(requester.sub)) {
      throw new ForbiddenException('No eres el dueño de este negocio.');
    }
  }

  /** Público: verifica propiedad por id de promoción (usado por el controller antes de subir a Cloudinary). */
  async assertPuedeGestionarPromocion(
    promoId: number,
    requester?: RequesterCtx,
  ): Promise<void> {
    if (!requester || requester.isAdmin) return;
    const promo = await this.promoRepo.findOne({
      where: { id: Number(promoId), eliminado: false },
    });
    if (!promo) throw new NotFoundException('Promoción global no encontrada.');
    await this.assertOwnershipByNegocio(promo.businessId, requester);
  }

  // =========================================================
  // CREATE
  // =========================================================
  async create(dto: CreatePromotionBusinessDto, requester?: RequesterCtx) {
    const negocioId = Number(dto.negocioId);

    if (!Number.isFinite(negocioId) || negocioId <= 0) {
      throw new BadRequestException('negocioId inválido.');
    }

    await this.assertOwnershipByNegocio(negocioId, requester);

    const sucursalIdsInput = Array.isArray(dto.sucursalIds)
      ? dto.sucursalIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : [];

    if (dto.aplicaTodasSucursales !== true && sucursalIdsInput.length === 0) {
      throw new BadRequestException('Debes enviar al menos una sucursal.');
    }

    // 1) Resolver sucursales válidas (SIEMPRE por join negocio)
    const sucursalesValidas = await this.resolveSucursalesValidas(
      negocioId,
      dto.aplicaTodasSucursales === true,
      sucursalIdsInput,
    );

    // 2) Crear promo global
    const promo = this.promoRepo.create({
      businessId: negocioId,
      titulo: dto.titulo?.trim(),
      descripcion: dto.descripcion ?? null,
      tipoPromocion: dto.tipoPromocion,
      valorDescuento: dto.valorDescuento ?? null,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      diasVigencia: dto.diasVigencia ?? null,
      horaInicio: dto.horaInicio ?? null,
      horaFin: dto.horaFin ?? null,
      condiciones: dto.condiciones ?? null,
      imagenUrl: dto.imagenUrl ?? null,
      aplicaTodasSucursales: dto.aplicaTodasSucursales === true,
      activa: dto.activa ?? true,
      eliminado: false,
    });

    const saved = await this.promoRepo.save(promo);

    // 3) Guardar tabla puente
    const idsToLink = sucursalesValidas.map((s) => Number(s.id));
    await this.replaceLinks(saved.id, idsToLink);

    // 4) Registrar evento
    await this.registrarEventoPromocionGlobal({
      tipoEvento: 'promocion_global_creada',
      negocioId,
      promocionId: saved.id,
      tituloPromocion: saved.titulo,
      descripcion: saved.descripcion,
      aplicaTodasSucursales: saved.aplicaTodasSucursales,
      sucursalIds: idsToLink,
      tipoPromocion: saved.tipoPromocion,
      valorDescuento: saved.valorDescuento,
      fechaInicio: saved.fechaInicio,
      fechaFin: saved.fechaFin,
      imagenUrl: saved.imagenUrl,
    });

    // 5) Respuesta consistente con tus GETs
    return this.findOne(saved.id);
  }

  // =========================================================
  // GET BY BUSINESS
  // =========================================================
  async findByBusiness(businessId: number) {
    const businessIdNumber = Number(businessId);
    if (!Number.isFinite(businessIdNumber) || businessIdNumber <= 0) {
      throw new BadRequestException('businessId inválido.');
    }

    const promos = await this.promoRepo.find({
      where: { businessId: businessIdNumber, eliminado: false },
      order: { id: 'DESC' },
    });

    const ids = promos.map((p) => p.id);
    if (ids.length === 0) return [];

    const links = await this.linkRepo.find({
      where: { promotionBusinessId: In(ids) },
      relations: { sucursal: { negocio: true } },
    });

    const map = new Map<number, any[]>();
    for (const l of links) {
      const arr = map.get(l.promotionBusinessId) ?? [];
      arr.push({
        id: String(l.sucursal.id),
        nombreSucursal: l.sucursal.nombreSucursal,
        negocioId: String(l.sucursal.negocio?.id ?? businessIdNumber),
      });
      map.set(l.promotionBusinessId, arr);
    }

    return promos.map((p) => ({
      ...p,
      sucursales: map.get(p.id) ?? [],
    }));
  }

  // =========================================================
  // GET ONE
  // =========================================================
  async findOne(id: number) {
    const promoId = Number(id);
    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
    });

    if (!promo) {
      throw new NotFoundException('Promoción global no encontrada.');
    }

    const links = await this.linkRepo.find({
      where: { promotionBusinessId: promoId },
      relations: { sucursal: { negocio: true } },
    });

    return {
      ...promo,
      sucursales: links.map((l) => ({
        id: String(l.sucursal.id),
        nombreSucursal: l.sucursal.nombreSucursal,
        negocioId: String(l.sucursal.negocio?.id ?? promo.businessId),
      })),
    };
  }

  // =========================================================
  // UPDATE
  // =========================================================
  async update(id: number, dto: UpdatePromotionBusinessDto, requester?: RequesterCtx) {
    const promoId = Number(id);
    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
    });

    if (!promo) {
      throw new NotFoundException('Promoción global no encontrada.');
    }

    await this.assertOwnershipByNegocio(promo.businessId, requester);

    // Campos editables
    if (dto.titulo !== undefined) promo.titulo = dto.titulo;
    if (dto.descripcion !== undefined) promo.descripcion = dto.descripcion;
    if (dto.tipoPromocion !== undefined) promo.tipoPromocion = dto.tipoPromocion;
    if (dto.valorDescuento !== undefined) promo.valorDescuento = dto.valorDescuento;
    if (dto.fechaInicio !== undefined) promo.fechaInicio = dto.fechaInicio;
    if (dto.fechaFin !== undefined) promo.fechaFin = dto.fechaFin;
    if (dto.diasVigencia !== undefined) promo.diasVigencia = dto.diasVigencia;
    if (dto.horaInicio !== undefined) promo.horaInicio = dto.horaInicio;
    if (dto.horaFin !== undefined) promo.horaFin = dto.horaFin;
    if (dto.condiciones !== undefined) promo.condiciones = dto.condiciones;
    if (dto.imagenUrl !== undefined) promo.imagenUrl = dto.imagenUrl;
    if (dto.activa !== undefined) promo.activa = dto.activa;

    if (dto.aplicaTodasSucursales !== undefined) {
      promo.aplicaTodasSucursales = dto.aplicaTodasSucursales;
    }

    await this.promoRepo.save(promo);

    // actualizar asociaciones si el cliente lo solicita o si cambia aplicaTodasSucursales
    const shouldUpdateLinks =
      dto.actualizarSucursales === true || dto.aplicaTodasSucursales !== undefined;

    if (shouldUpdateLinks) {
      const sucursalIdsInput = Array.isArray(dto.sucursalIds)
        ? dto.sucursalIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
        : [];

      if (promo.aplicaTodasSucursales !== true && sucursalIdsInput.length === 0) {
        throw new BadRequestException('Debes seleccionar al menos una sucursal.');
      }

      const sucursalesValidas = await this.resolveSucursalesValidas(
        promo.businessId,
        promo.aplicaTodasSucursales === true,
        sucursalIdsInput,
      );

      await this.replaceLinks(
        promo.id,
        sucursalesValidas.map((s) => Number(s.id)),
      );
    }

    const linksActualizados = await this.linkRepo.find({
      where: { promotionBusinessId: promo.id },
    });

    await this.registrarEventoPromocionGlobal({
      tipoEvento: 'promocion_global_actualizada',
      negocioId: promo.businessId,
      promocionId: promo.id,
      tituloPromocion: promo.titulo,
      descripcion: promo.descripcion,
      aplicaTodasSucursales: promo.aplicaTodasSucursales,
      sucursalIds: linksActualizados.map((x) => Number(x.sucursalId)),
      tipoPromocion: promo.tipoPromocion,
      valorDescuento: promo.valorDescuento,
      fechaInicio: promo.fechaInicio,
      fechaFin: promo.fechaFin,
      imagenUrl: promo.imagenUrl,
    });

    return this.findOne(promo.id);
  }

  // =========================================================
  // DELETE (soft)
  // =========================================================
  async remove(id: number, requester?: RequesterCtx) {
    const promoId = Number(id);
    if (!Number.isFinite(promoId) || promoId <= 0) {
      throw new BadRequestException('id inválido.');
    }

    const promo = await this.promoRepo.findOne({
      where: { id: promoId, eliminado: false },
    });

    if (!promo) {
      throw new NotFoundException('Promoción global no encontrada.');
    }

    await this.assertOwnershipByNegocio(promo.businessId, requester);

    promo.eliminado = true;
    await this.promoRepo.save(promo);

    await this.linkRepo.delete({ promotionBusinessId: promoId });

    await this.registrarEventoPromocionGlobal({
      tipoEvento: 'promocion_global_eliminada',
      negocioId: promo.businessId,
      promocionId: promo.id,
      tituloPromocion: promo.titulo,
      descripcion: promo.descripcion,
      aplicaTodasSucursales: promo.aplicaTodasSucursales,
      sucursalIds: [],
      tipoPromocion: promo.tipoPromocion,
      valorDescuento: promo.valorDescuento,
      fechaInicio: promo.fechaInicio,
      fechaFin: promo.fechaFin,
      imagenUrl: promo.imagenUrl,
    });

    return { ok: true };
  }

  // =========================================================
  // HELPERS
  // =========================================================

  /**
   * Resuelve sucursales válidas SIEMPRE por relación real negocio->sucursal.
   * - aplicaTodas = true: trae todas las sucursales del negocio (no eliminadas)
   * - aplicaTodas = false: valida que ids pertenezcan al negocio y no estén eliminadas
   */
  private async resolveSucursalesValidas(
    negocioId: number,
    aplicaTodas: boolean,
    ids: number[],
  ): Promise<Pick<SucursalNegocio, 'id' | 'nombreSucursal'>[]> {
    if (aplicaTodas) {
      const all = await this.sucursalRepo
        .createQueryBuilder('s')
        .innerJoin('s.negocio', 'n')
        .where('n.id = :negocioId', { negocioId })
        .andWhere('s.eliminado = 0')
        .select(['s.id', 's.nombreSucursal'])
        .getMany();

      if (!all.length) {
        throw new BadRequestException('El negocio no tiene sucursales activas.');
      }

      return all;
    }

    const uniqueIds = Array.from(new Set(ids));
    const found = await this.sucursalRepo
      .createQueryBuilder('s')
      .innerJoin('s.negocio', 'n')
      .where('n.id = :negocioId', { negocioId })
      .andWhere('s.eliminado = 0')
      .andWhere('s.id IN (:...ids)', { ids: uniqueIds })
      .select(['s.id', 's.nombreSucursal'])
      .getMany();

    if (found.length !== uniqueIds.length) {
      throw new BadRequestException('Una o más sucursales no pertenecen a este negocio.');
    }

    return found;
  }

  private async replaceLinks(promotionBusinessId: number, sucursalIds: number[]) {
    await this.linkRepo.delete({ promotionBusinessId });

    const rows = sucursalIds.map((sucursalId) =>
      this.linkRepo.create({ promotionBusinessId, sucursalId }),
    );

    await this.linkRepo.save(rows);
  }

  private async registrarEventoPromocionGlobal(params: {
    tipoEvento: 'promocion_global_creada' | 'promocion_global_actualizada' | 'promocion_global_eliminada';
    negocioId: number;
    promocionId: number;
    tituloPromocion: string;
    descripcion?: string | null;
    aplicaTodasSucursales?: boolean;
    sucursalIds?: number[];
    tipoPromocion?: string | null;
    valorDescuento?: number | null;
    fechaInicio?: any;
    fechaFin?: any;
    imagenUrl?: string | null;
  }) {
    const {
      tipoEvento,
      negocioId,
      promocionId,
      tituloPromocion,
      descripcion,
      aplicaTodasSucursales,
      sucursalIds,
      tipoPromocion,
      valorDescuento,
      fechaInicio,
      fechaFin,
      imagenUrl,
    } = params;

    let tituloEvento = '';
    let descripcionEvento = '';

    if (tipoEvento === 'promocion_global_creada') {
      tituloEvento = 'Nueva promoción global disponible';
      descripcionEvento = tituloPromocion || 'El negocio publicó una nueva promoción global.';
    }

    if (tipoEvento === 'promocion_global_actualizada') {
      tituloEvento = 'Promoción global actualizada';
      descripcionEvento = tituloPromocion || 'El negocio actualizó una promoción global.';
    }

    if (tipoEvento === 'promocion_global_eliminada') {
      tituloEvento = 'Promoción global finalizada';
      descripcionEvento = tituloPromocion || 'El negocio retiró una promoción global.';
    }

    await this.eventosNegociosService.crear({
      negocioId,
      tipoEvento,
      titulo: tituloEvento,
      descripcion: descripcionEvento,
      visibleParaFavoritos: true,
      activo: true,
      payload: {
        promocionGlobalId: promocionId,
        tituloPromocion,
        descripcionPromocion: descripcion ?? null,
        aplicaTodasSucursales: aplicaTodasSucursales ?? false,
        sucursalIds: sucursalIds ?? [],
        tipoPromocion: tipoPromocion ?? null,
        valorDescuento: valorDescuento ?? null,
        fechaInicio: fechaInicio ?? null,
        fechaFin: fechaFin ?? null,
        imagenUrl: imagenUrl ?? null,
      },
    });
  }
}