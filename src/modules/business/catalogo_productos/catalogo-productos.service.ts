import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriaCatalogo } from './entities/categoria-catalogo.entity';
import { ItemNegocio } from './entities/item-negocio.entity';
import { ItemSucursal } from './entities/item-sucursal.entity';
import { Negocio } from '../negocios/entities/negocio.entity';
import { CreateCategoriaDto, CreateItemNegocioDto, UpdateItemSucursalDto } from './dtos/create-update-catalogo.dto';

// JLP-H19 — Propiedad: solo el dueño del negocio (o un admin) puede gestionar
// su catálogo (categorías, ítems y disponibilidad). requester opcional para no
// romper llamadas internas.
export type RequesterCtx = { sub: number; isAdmin: boolean };

@Injectable()
export class CatalogoProductosService {
  constructor(
    @InjectRepository(CategoriaCatalogo) private catRepo: Repository<CategoriaCatalogo>,
    @InjectRepository(ItemNegocio) private itemRepo: Repository<ItemNegocio>,
    @InjectRepository(ItemSucursal) private availabilityRepo: Repository<ItemSucursal>,
    @InjectRepository(Negocio) private negocioRepo: Repository<Negocio>,
  ) {}

  // ================= PROPIEDAD =================
  /**
   * Verifica que el solicitante sea dueño del negocio (vía negocio →
   * suscriptor) o admin. Se salta la verificación cuando no hay `requester`
   * (llamadas internas) o es admin.
   */
  private async assertOwnershipByNegocio(
    negocioId: number,
    requester?: RequesterCtx,
  ) {
    if (!requester || requester.isAdmin) return;

    const negocio = await this.negocioRepo.findOne({
      where: { id: negocioId },
      relations: ['suscriptor'],
    });

    if (!negocio) {
      throw new NotFoundException('Negocio no encontrado');
    }

    const ownerId = Number(negocio.suscriptor?.id);
    if (!ownerId || ownerId !== Number(requester.sub)) {
      throw new ForbiddenException(
        'No tienes permiso para gestionar este catálogo',
      );
    }
  }

  /** Resuelve el negocioId de un ítem (lanza NotFound si no existe). */
  private async resolveNegocioIdByItem(itemId: number): Promise<number> {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }
    return Number(item.negocioId);
  }

  /** Wrapper público: valida propiedad por negocio (usado antes de subir a Cloudinary). */
  async assertPuedeGestionarNegocio(negocioId: number, requester?: RequesterCtx) {
    return this.assertOwnershipByNegocio(negocioId, requester);
  }

  /** Wrapper público: valida propiedad resolviendo el negocio desde el ítem. */
  async assertPuedeGestionarItem(itemId: number, requester?: RequesterCtx) {
    const negocioId = await this.resolveNegocioIdByItem(itemId);
    return this.assertOwnershipByNegocio(negocioId, requester);
  }

  // ================= CATEGORÍAS =================
  async crearCategoria(dto: CreateCategoriaDto, requester?: RequesterCtx) {
    await this.assertOwnershipByNegocio(dto.negocioId, requester);
    return this.catRepo.save(this.catRepo.create(dto));
  }

  async getCategorias(negocioId: number) {
    return this.catRepo.find({ where: { negocioId, activo: true } });
  }

  // ================= ITEMS GLOBALES (NEGOCIO) =================
  async crearItem(
    dto: CreateItemNegocioDto & { imagenUrl?: string },
    requester?: RequesterCtx,
  ) {
    await this.assertOwnershipByNegocio(dto.negocioId, requester);
    return this.itemRepo.save(this.itemRepo.create(dto));
  }

  async getItemsNegocio(negocioId: number) {
    return this.itemRepo.find({
      where: { negocioId, activo: true },
      relations: ['categoria']
    });
  }

  // ================= DISPONIBILIDAD (SUCURSAL) =================
  
  // Asignar o actualizar precio/disponibilidad en una sucursal
  async setDisponibilidad(dto: UpdateItemSucursalDto, requester?: RequesterCtx) {
    // La propiedad se valida a través del ítem del negocio.
    const negocioId = await this.resolveNegocioIdByItem(dto.itemNegocioId);
    await this.assertOwnershipByNegocio(negocioId, requester);

    let registro = await this.availabilityRepo.findOne({
      where: { sucursalId: dto.sucursalId, itemNegocioId: dto.itemNegocioId }
    });

    if (!registro) {
      // Si no existe, creamos la relación
      registro = this.availabilityRepo.create(dto);
    } else {
      // Si existe, actualizamos
      registro.precioEspecifico = dto.precioEspecifico ?? null; // Nullish coalescing para permitir null
      registro.disponible = dto.disponible;
    }

    return this.availabilityRepo.save(registro);
  }

  // ================= EL MENÚ FINAL (LO QUE VE EL CLIENTE) =================
  async getMenuParaSucursal(sucursalId: number, negocioId: number) {
    // 1. Traer todos los items activos del negocio
    const itemsGlobales = await this.itemRepo.find({
      where: { negocioId, activo: true },
      relations: ['categoria']
    });

    // 2. Traer las reglas específicas de esta sucursal
    const reglasSucursal = await this.availabilityRepo.find({
      where: { sucursalId }
    });

    // 3. MEZCLAR DATOS (Mapping)
    const menu = itemsGlobales.map(item => {
      // Buscamos si hay regla para este item
      const regla = reglasSucursal.find(r => Number(r.itemNegocioId) === Number(item.id));

      // Si la regla dice disponible=false, lo marcamos para no mostrarlo o mostrarlo agotado
      // Si no hay regla, por defecto está DISPONIBLE con precio BASE
      const estaDisponible = regla ? regla.disponible : true;
      
      // Precio final: Si hay regla y tiene precio, úsalo. Si no, usa el base.
      const precioFinal = (regla && regla.precioEspecifico != null) 
                          ? regla.precioEspecifico 
                          : item.precioBase;

      return {
        ...item,
        precioFinal: Number(precioFinal), // Asegurar que sea número
        disponibleEnSucursal: estaDisponible
      };
    });

    // 4. Filtrar solo los disponibles (Opcional: Si quieres ocultar los no disponibles)
    return menu.filter(x => x.disponibleEnSucursal);
  }

async actualizarItem(id: number, data: any, requester?: RequesterCtx) {
    await this.assertPuedeGestionarItem(id, requester);

    // Usamos 'update' de TypeORM
    await this.itemRepo.update(id, data);

    // Retornamos el item actualizado
    return this.itemRepo.findOne({ where: { id } });
  }

  async eliminarItem(id: number, requester?: RequesterCtx) {
    await this.assertPuedeGestionarItem(id, requester);
    return this.itemRepo.delete(id);
  }
  
}