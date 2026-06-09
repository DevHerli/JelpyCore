import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Negocio } from './entities/negocio.entity';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';

@Injectable()
export class NegociosService {
  constructor(
    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,
  ) {}

  // ============================================================
  // HELPERS
  // ============================================================
  private toNegocioResumenResponse(negocio: Negocio): any {
    return {
      id: negocio.id,
      nombreNegocio: negocio.nombreNegocio,
      descripcion: negocio.descripcion,
      logoUrl: negocio.logoUrl,
      fechaRegistro: negocio.fechaRegistro,
      fechaActualizacion: negocio.fechaActualizacion,

      categoria: negocio.categoria
        ? {
            id: negocio.categoria.id,
            nombre: (negocio.categoria as any).nombre,
          }
        : null,

      subcategoria: negocio.subcategoria
        ? {
            id: negocio.subcategoria.id,
            nombre: (negocio.subcategoria as any).nombre,
          }
        : null,

      especialidad: negocio.especialidad
        ? {
            id: negocio.especialidad.id,
            nombre: (negocio.especialidad as any).nombre,
          }
        : null,

      ciudad: negocio.ciudad
        ? {
            id: negocio.ciudad.id,
            nombre: (negocio.ciudad as any).nombre,
          }
        : null,

      estado: negocio.estado
        ? {
            id: negocio.estado.id,
            nombre: (negocio.estado as any).nombre,
          }
        : null,
    };
  }

  private toNegocioDetalleResponse(negocio: any): any {
    return {
      negocio: this.toNegocioResumenResponse(negocio),
      sucursales: (negocio.sucursales || []).map((sucursal: any) => ({
        id: sucursal.id,
        nombreSucursal: sucursal.nombreSucursal,
        imagenUrl: sucursal.imagenUrl,
        calle: sucursal.calle,
        numeroExterior: sucursal.numeroExterior,
        numeroInterior: sucursal.numeroInterior,
        colonia: sucursal.colonia,
        entreCalle1: sucursal.entreCalle1,
        entreCalle2: sucursal.entreCalle2,
        codigoPostal: sucursal.codigoPostal,
        referenciaMapa: sucursal.referenciaMapa,
        tipoSucursal: sucursal.tipoSucursal,
        telefonoFijo1: sucursal.telefonoFijo1,
        telefonoFijo2: sucursal.telefonoFijo2,
        telefonoFijo3: sucursal.telefonoFijo3,
        telefonoCelular1: sucursal.telefonoCelular1,
        telefonoCelular2: sucursal.telefonoCelular2,
        telefonoCelular3: sucursal.telefonoCelular3,
        telefonoCelular4: sucursal.telefonoCelular4,
        correoContacto: sucursal.correoContacto,
        whatsapp: sucursal.whatsapp,
        esMatriz: sucursal.esMatriz,
        latitud: sucursal.latitud,
        longitud: sucursal.longitud,
        fechaRegistro: sucursal.fechaRegistro,
        fechaActualizacion: sucursal.fechaActualizacion,

        ciudad: sucursal.ciudad
          ? {
              id: sucursal.ciudad.id,
              nombre: sucursal.ciudad.nombre,
            }
          : null,

        estado: sucursal.estado
          ? {
              id: sucursal.estado.id,
              nombre: sucursal.estado.nombre,
            }
          : null,

        horarios: sucursal.horarios || [],
        imagenes: sucursal.imagenes || [],
      })),
      resumen: {
        totalSucursales: negocio.sucursales?.length || 0,
        fechaRegistro: negocio.fechaRegistro,
        ultimaActualizacion: negocio.fechaActualizacion,
      },
    };
  }

  // ============================================================
  // CRUD / CONSULTAS
  // ============================================================
  async listar(): Promise<any[]> {
    const negocios = await this.negocioRepo.find({
      where: { eliminado: false },
      relations: [
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
      ],
      order: { nombreNegocio: 'ASC' },
    });

    return negocios.map((negocio) => this.toNegocioResumenResponse(negocio));
  }

  async obtenerPorId(id: number): Promise<any> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
      ],
    });

    if (!negocio) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return this.toNegocioResumenResponse(negocio);
  }

  async listarPorSuscriptor(suscriptorId: number): Promise<any[]> {
    const negocios = await this.negocioRepo.find({
      where: {
        suscriptor: { id: suscriptorId },
        eliminado: false,
      },
      relations: [
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
      ],
      order: { id: 'ASC' },
    });

    return negocios.map((negocio) => this.toNegocioResumenResponse(negocio));
  }

  async obtenerDetalle(id: number): Promise<any> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
        'sucursales.ciudad',
        'sucursales.estado',
        'sucursales.horarios',
        'sucursales.imagenes',
      ],
    });

    if (!negocio) {
      throw new NotFoundException(`No se encontró el negocio con id ${id}`);
    }

    return this.toNegocioDetalleResponse(negocio);
  }

  async crear(data: CreateNegocioDto & { logoUrl?: string | null }): Promise<Negocio> {
    const negocio = this.negocioRepo.create({
      nombreNegocio: data.nombreNegocio,
      descripcion: data.descripcion,
      logoUrl: data.logoUrl ?? undefined,
      suscriptor: { id: data.suscriptorId } as any,
      ciudad: { id: data.ciudadId } as any,
      categoria: { id: data.categoriaId } as any,
      subcategoria: data.subcategoriaId ? ({ id: data.subcategoriaId } as any) : null,
      especialidad: data.especialidadId ? ({ id: data.especialidadId } as any) : null,
      estado: { id: data.estadoId } as any,
    });

    return this.negocioRepo.save(negocio);
  }

  async actualizar(id: number, dto: UpdateNegocioDto): Promise<Negocio> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: ['suscriptor', 'ciudad', 'categoria', 'subcategoria', 'especialidad', 'estado'],
    });

    if (!negocio) {
      throw new NotFoundException('Negocio no encontrado');
    }

    if (dto.nombreNegocio !== undefined) negocio.nombreNegocio = dto.nombreNegocio;
    if (dto.descripcion !== undefined) negocio.descripcion = dto.descripcion;
    if ((dto as any).logoUrl !== undefined) negocio.logoUrl = (dto as any).logoUrl;

    if ((dto as any).suscriptorId !== undefined) {
      negocio.suscriptor = { id: (dto as any).suscriptorId } as any;
    }

    if ((dto as any).ciudadId !== undefined) {
      negocio.ciudad = { id: (dto as any).ciudadId } as any;
    }

    if ((dto as any).categoriaId !== undefined) {
      negocio.categoria = { id: (dto as any).categoriaId } as any;
    }

    if ((dto as any).subcategoriaId !== undefined) {
      negocio.subcategoria = (dto as any).subcategoriaId
        ? ({ id: (dto as any).subcategoriaId } as any)
        : null;
    }

    if ((dto as any).especialidadId !== undefined) {
      negocio.especialidad = (dto as any).especialidadId
        ? ({ id: (dto as any).especialidadId } as any)
        : null;
    }

    if ((dto as any).estadoId !== undefined) {
      negocio.estado = { id: (dto as any).estadoId } as any;
    }

    return this.negocioRepo.save(negocio);
  }

  async eliminar(id: number): Promise<void> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
    });

    if (!negocio) {
      throw new NotFoundException('Negocio no encontrado');
    }

    negocio.eliminado = true;
    await this.negocioRepo.save(negocio);
  }

  // ============================================================
  // CONTROL DE ACCESO: Admin vs Owner
  // ============================================================

  /** Elimina sin validar ownership — solo para SuperAdmin del panel */
  async eliminarComoAdmin(id: number): Promise<void> {
    await this.eliminar(id);
  }

  /** Elimina validando que el userId sea el dueño del negocio */
  async eliminarComoOwner(id: number, userId: number): Promise<void> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: ['suscriptor'],
    });

    if (!negocio) throw new NotFoundException('Negocio no encontrado');

    if (Number(negocio.suscriptor?.id) !== Number(userId)) {
      throw new UnauthorizedException('No eres el dueño de este negocio');
    }

    negocio.eliminado = true;
    await this.negocioRepo.save(negocio);
  }

  /** Actualiza sin validar ownership — solo para SuperAdmin del panel */
  async actualizarComoAdmin(id: number, dto: UpdateNegocioDto): Promise<Negocio> {
    return this.actualizar(id, dto);
  }

  /** Actualiza validando que el userId sea el dueño del negocio */
  async actualizarComoOwner(
    id: number,
    dto: UpdateNegocioDto,
    userId: number,
  ): Promise<Negocio> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: ['suscriptor'],
    });

    if (!negocio) throw new NotFoundException('Negocio no encontrado');

    if (Number(negocio.suscriptor?.id) !== Number(userId)) {
      throw new UnauthorizedException('No eres el dueño de este negocio');
    }

    return this.actualizar(id, dto);
  }
}