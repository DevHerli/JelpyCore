import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriaCatalogo } from './entities/categoria-catalogo.entity';
import { ItemNegocio } from './entities/item-negocio.entity';
import { ItemSucursal } from './entities/item-sucursal.entity';
import { CreateCategoriaDto, CreateItemNegocioDto, UpdateItemSucursalDto } from './dtos/create-update-catalogo.dto';

@Injectable()
export class CatalogoProductosService {
  constructor(
    @InjectRepository(CategoriaCatalogo) private catRepo: Repository<CategoriaCatalogo>,
    @InjectRepository(ItemNegocio) private itemRepo: Repository<ItemNegocio>,
    @InjectRepository(ItemSucursal) private availabilityRepo: Repository<ItemSucursal>,
  ) {}

  // ================= CATEGORÍAS =================
  async crearCategoria(dto: CreateCategoriaDto) {
    return this.catRepo.save(this.catRepo.create(dto));
  }

  async getCategorias(negocioId: number) {
    return this.catRepo.find({ where: { negocioId, activo: true } });
  }

  // ================= ITEMS GLOBALES (NEGOCIO) =================
  async crearItem(dto: CreateItemNegocioDto & { imagenUrl?: string }) {
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
  async setDisponibilidad(dto: UpdateItemSucursalDto) {
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

async actualizarItem(id: number, data: any) {
    // Usamos 'update' de TypeORM
    await this.itemRepo.update(id, data);
    
    // Retornamos el item actualizado
    return this.itemRepo.findOne({ where: { id } });
  }

  async eliminarItem(id: number) {
    return this.itemRepo.delete(id);
  }
  
}