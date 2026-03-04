import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { SucursalNegocio } from './entities/sucursal-negocio.entity';
import { SucursalImagen } from './entities/sucursal-imagen.entity';
import { CreateSucursalNegocioDto } from './dto/create-sucursal-negocio.dto';
import { UpdateSucursalNegocioDto } from './dto/update-sucursal-negocio.dto';

@Injectable()
export class SucursalesNegociosService {
  constructor(
    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(SucursalImagen)
    private readonly imagenRepo: Repository<SucursalImagen>,
  ) {}

  // =================================================================
  // Crear (Mantenemos tu lógica de imagenUrl)
  // =================================================================
  async crear(dto: CreateSucursalNegocioDto & { imagenUrl?: string }): Promise<SucursalNegocio> {
    const entity = this.sucursalRepo.create({
      ...dto,
      imagenUrl: dto.imagenUrl, 
      negocio: { id: dto.negocioId } as any,
      ciudad: { id: dto.ciudadId } as any,
      estado: { id: dto.estadoId } as any,
    });
    return this.sucursalRepo.save(entity);
  }

  async agregarImagenes(sucursalId: number, fotos: { url: string; publicId: string }[]) {
    const entities = fotos.map(foto => 
      this.imagenRepo.create({
        url: foto.url,
        publicId: foto.publicId,
        sucursal: { id: sucursalId } as any
      })
    );
    return this.imagenRepo.save(entities);
  }

  // =================================================================
  // LISTAR: Agregamos relaciones para que venga la membresía
  // =================================================================
  async listar(params?: {
    negocioId?: number;
    ciudadId?: number;
    estadoId?: number;
  }): Promise<SucursalNegocio[]> {
    const where: FindOptionsWhere<SucursalNegocio> = { eliminado: false } as any;

    if (params?.negocioId) where.negocio = { id: params.negocioId } as any;
    if (params?.ciudadId) where.ciudad = { id: params.ciudadId } as any;
    if (params?.estadoId) where.estado = { id: params.estadoId } as any;

    return this.sucursalRepo.find({
      where,
      order: { id: 'ASC' },
      relations: [
        'negocio',
        'negocio.suscriptor',           // <--- IMPORTANTE
        'negocio.suscriptor.membresia', // <--- AQUÍ ESTÁ EL PLAN
        'caracteristicas',          
        'caracteristicas.caracteristica',
        'horarios',
        'imagenes' 
      ],
    });
  }

  async listarPorNegocio(negocioId: number): Promise<SucursalNegocio[]> {
    return this.listar({ negocioId });
  }

  // =================================================================
  // OBTENER: Agregamos relaciones (ESTA ES LA QUE USA TU MODAL)
  // =================================================================
  async obtener(id: number): Promise<SucursalNegocio> {
    const suc = await this.sucursalRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        'negocio',
        'negocio.suscriptor',           // <--- NECESARIO
        'negocio.suscriptor.membresia', // <--- TRAE "CORTESIA"
        'caracteristicas',              
        'caracteristicas.caracteristica',
        'horarios',
        'imagenes',
        'ciudad',                       // <--- Agregado por si lo usas en el header
        'estado'
      ],
    });

    if (!suc) throw new NotFoundException('Sucursal no encontrada');
    return suc;
  }

  // =================================================================
  // Actualizar
  // =================================================================
  async actualizar(id: number, dto: UpdateSucursalNegocioDto & { imagenUrl?: string }): Promise<SucursalNegocio> {
    const suc = await this.obtener(id);

    const rels: Partial<SucursalNegocio> = {};
    if (dto.negocioId) rels.negocio = { id: dto.negocioId } as any;
    if (dto.ciudadId) rels.ciudad = { id: dto.ciudadId } as any;
    if (dto.estadoId) rels.estado = { id: dto.estadoId } as any;

    if (dto.imagenUrl) {
      suc.imagenUrl = dto.imagenUrl;
    }

    Object.assign(suc, dto, rels);
    return this.sucursalRepo.save(suc);
  }

  async eliminar(id: number): Promise<void> {
    const suc = await this.obtener(id);
    suc.eliminado = true;
    await this.sucursalRepo.save(suc);
  }

  async eliminarImagen(imagenId: number) {
    const img = await this.imagenRepo.findOne({ where: { id: imagenId } });
    if (img) {
      await this.imagenRepo.remove(img);
      return img.publicId; 
    }
    return null;
  }
}