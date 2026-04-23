import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';

import { SucursalNegocio } from './entities/sucursal-negocio.entity';
import { SucursalImagen } from './entities/sucursal-imagen.entity';
import { CreateSucursalNegocioDto } from './dto/create-sucursal-negocio.dto';
import { UpdateSucursalNegocioDto } from './dto/update-sucursal-negocio.dto';
import { Street } from '../domicilios/calles/entities/street.entity';
import { Colonia } from '../domicilios/colonias/entities/colonia.entity';
import { PostalCode } from '../domicilios/codigos_postal/entities/postal-code.entity';

@Injectable()
export class SucursalesNegociosService {
  constructor(
    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,

    @InjectRepository(SucursalImagen)
    private readonly imagenRepo: Repository<SucursalImagen>,

    @InjectRepository(Street)
    private readonly streetRepo: Repository<Street>,

    @InjectRepository(Colonia)
    private readonly coloniaRepo: Repository<Colonia>,

    @InjectRepository(PostalCode)
    private readonly postalCodeRepo: Repository<PostalCode>,
  ) {}

  // ================================================================
  // HELPERS
  // ================================================================
  private async findSucursalEntityOrFail(id: number): Promise<SucursalNegocio> {
    const suc = await this.sucursalRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        'negocio',
        'caracteristicas',
        'caracteristicas.caracteristica',
        'horarios',
        'imagenes',
        'ciudad',
        'estado',
      ],
    });

    if (!suc) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    return suc;
  }

private toSucursalResumenResponse(item: any): any {
  return {
    id: item.id,
    nombreSucursal: item.nombreSucursal,
    imagenUrl: item.imagenUrl,
    esMatriz: item.esMatriz,
    tipoSucursal: item.tipoSucursal,
    referenciaMapa: item.referenciaMapa,
    fechaRegistro: item.fechaRegistro,
    fechaActualizacion: item.fechaActualizacion,

    direccion: {
      calle: item.calleNombre ?? item.calle,
      numeroExterior: item.numeroExterior,
      numeroInterior: item.numeroInterior,
      colonia: item.coloniaNombre ?? item.colonia,
      entreCalle1: item.entreCalle1,
      entreCalle2: item.entreCalle2,
      codigoPostal: item.codigoPostalNombre ?? item.codigoPostal,
    },

    contacto: {
      telefonoFijo1: item.telefonoFijo1,
      telefonoFijo2: item.telefonoFijo2,
      telefonoFijo3: item.telefonoFijo3,
      telefonoCelular1: item.telefonoCelular1,
      telefonoCelular2: item.telefonoCelular2,
      telefonoCelular3: item.telefonoCelular3,
      telefonoCelular4: item.telefonoCelular4,
      correoContacto: item.correoContacto,
      whatsapp: item.whatsapp,
    },

    ubicacion: {
      latitud: item.latitud,
      longitud: item.longitud,
      ciudad: item.ciudad
        ? {
            id: item.ciudad.id,
            nombre: item.ciudad.nombre,
          }
        : null,
      estado: item.estado
        ? {
            id: item.estado.id,
            nombre: item.estado.nombre,
          }
        : null,
    },

    negocio: item.negocio
      ? {
          id: item.negocio.id,
          nombreNegocio: item.negocio.nombreNegocio,
          descripcion: item.negocio.descripcion,
          logoUrl: item.negocio.logoUrl,
        }
      : null,
  };
}

  private toSucursalDetalleResponse(item: any): any {
    return {
      ...this.toSucursalResumenResponse(item),
      horarios: item.horarios ?? [],
      imagenes: item.imagenes ?? [],
      caracteristicas: item.caracteristicas ?? [],
    };
  }

  // ================================================================
  // CREAR
  // ================================================================
  async crear(
    dto: CreateSucursalNegocioDto & { imagenUrl?: string },
  ): Promise<SucursalNegocio> {
    const entity = this.sucursalRepo.create({
      nombreSucursal: dto.nombreSucursal,
      calle: dto.calle,
      numeroExterior: dto.numeroExterior,
      numeroInterior: dto.numeroInterior,
      colonia: dto.colonia,
      entreCalle1: dto.entreCalle1,
      entreCalle2: dto.entreCalle2,
      codigoPostal: dto.codigoPostal,
      referenciaMapa: dto.referenciaMapa,
      tipoSucursal: dto.tipoSucursal,
      latitud: dto.latitud,
      longitud: dto.longitud,
      telefonoFijo1: dto.telefonoFijo1,
      telefonoFijo2: dto.telefonoFijo2,
      telefonoFijo3: dto.telefonoFijo3,
      telefonoCelular1: dto.telefonoCelular1,
      telefonoCelular2: dto.telefonoCelular2,
      telefonoCelular3: dto.telefonoCelular3,
      telefonoCelular4: dto.telefonoCelular4,
      correoContacto: dto.correoContacto,
      whatsapp: dto.whatsapp,
      esMatriz: dto.esMatriz ?? false,
      imagenUrl: dto.imagenUrl,
      negocio: { id: dto.negocioId } as any,
      ciudad: { id: dto.ciudadId } as any,
      estado: { id: dto.estadoId } as any,
    });

    return this.sucursalRepo.save(entity);
  }

  async agregarImagenes(
    sucursalId: number,
    fotos: { url: string; publicId: string }[],
  ) {
    const entities = fotos.map((foto) =>
      this.imagenRepo.create({
        url: foto.url,
        publicId: foto.publicId,
        sucursal: { id: sucursalId } as any,
      }),
    );

    return this.imagenRepo.save(entities);
  }

  // ================================================================
  // LISTAR
  // ================================================================
async listar(params?: {
  negocioId?: number;
  ciudadId?: number;
  estadoId?: number;
}): Promise<any[]> {
  const where: FindOptionsWhere<SucursalNegocio> = {
    eliminado: false,
  } as any;

  if (params?.negocioId) {
    where.negocio = { id: params.negocioId } as any;
  }

  if (params?.ciudadId) {
    where.ciudad = { id: params.ciudadId } as any;
  }

  if (params?.estadoId) {
    where.estado = { id: params.estadoId } as any;
  }

  const sucursales = await this.sucursalRepo.find({
    where,
    order: { id: 'ASC' },
    relations: [
      'negocio',
      'ciudad',
      'estado',
    ],
  });

  const sucursalesConDireccion = await this.resolveAddressCatalogs(sucursales as any[]);

  return sucursalesConDireccion.map((item) => this.toSucursalResumenResponse(item));
}

  async listarPorNegocio(negocioId: number): Promise<any[]> {
    return this.listar({ negocioId });
  }

  // ================================================================
  // OBTENER
  // ================================================================
 async obtener(id: number): Promise<any> {
  const suc = await this.findSucursalEntityOrFail(id);
  const [sucursalConDireccion] = await this.resolveAddressCatalogs([suc as any]);
  return this.toSucursalDetalleResponse(sucursalConDireccion);
}

  // ================================================================
  // ACTUALIZAR
  // ================================================================
  async actualizar(
    id: number,
    dto: UpdateSucursalNegocioDto & { imagenUrl?: string },
  ): Promise<SucursalNegocio> {
    const suc = await this.findSucursalEntityOrFail(id);

    if (dto.negocioId !== undefined) {
      suc.negocio = { id: dto.negocioId } as any;
    }

    if (dto.ciudadId !== undefined) {
      suc.ciudad = { id: dto.ciudadId } as any;
    }

    if (dto.estadoId !== undefined) {
      suc.estado = { id: dto.estadoId } as any;
    }

    if (dto.nombreSucursal !== undefined) suc.nombreSucursal = dto.nombreSucursal;
    if (dto.calle !== undefined) suc.calle = dto.calle;
    if (dto.numeroExterior !== undefined) suc.numeroExterior = dto.numeroExterior;
    if (dto.numeroInterior !== undefined) suc.numeroInterior = dto.numeroInterior;
    if (dto.colonia !== undefined) suc.colonia = dto.colonia;
    if (dto.entreCalle1 !== undefined) suc.entreCalle1 = dto.entreCalle1;
    if (dto.entreCalle2 !== undefined) suc.entreCalle2 = dto.entreCalle2;
    if (dto.codigoPostal !== undefined) suc.codigoPostal = dto.codigoPostal;
    if (dto.referenciaMapa !== undefined) suc.referenciaMapa = dto.referenciaMapa;
    if (dto.tipoSucursal !== undefined) suc.tipoSucursal = dto.tipoSucursal;
    if (dto.latitud !== undefined) suc.latitud = dto.latitud;
    if (dto.longitud !== undefined) suc.longitud = dto.longitud;
    if (dto.telefonoFijo1 !== undefined) suc.telefonoFijo1 = dto.telefonoFijo1;
    if (dto.telefonoFijo2 !== undefined) suc.telefonoFijo2 = dto.telefonoFijo2;
    if (dto.telefonoFijo3 !== undefined) suc.telefonoFijo3 = dto.telefonoFijo3;
    if (dto.telefonoCelular1 !== undefined) suc.telefonoCelular1 = dto.telefonoCelular1;
    if (dto.telefonoCelular2 !== undefined) suc.telefonoCelular2 = dto.telefonoCelular2;
    if (dto.telefonoCelular3 !== undefined) suc.telefonoCelular3 = dto.telefonoCelular3;
    if (dto.telefonoCelular4 !== undefined) suc.telefonoCelular4 = dto.telefonoCelular4;
    if (dto.correoContacto !== undefined) suc.correoContacto = dto.correoContacto;
    if (dto.whatsapp !== undefined) suc.whatsapp = dto.whatsapp;
    if (dto.esMatriz !== undefined) suc.esMatriz = dto.esMatriz;
    if (dto.imagenUrl !== undefined) suc.imagenUrl = dto.imagenUrl;

    return this.sucursalRepo.save(suc);
  }

  // ================================================================
  // ELIMINAR
  // ================================================================
  async eliminar(id: number): Promise<void> {
    const suc = await this.findSucursalEntityOrFail(id);
    suc.eliminado = true;
    await this.sucursalRepo.save(suc);
  }

  async eliminarImagen(imagenId: number) {
    const img = await this.imagenRepo.findOne({
      where: { id: imagenId },
    });

    if (img) {
      await this.imagenRepo.remove(img);
      return img.publicId;
    }

    return null;
  }


  private async resolveAddressCatalogs(items: any[]): Promise<any[]> {
  if (!items?.length) return [];

  const calleIds = [
    ...new Set(
      items
        .map((x) => x?.calle)
        .filter((v) => v !== null && v !== undefined && `${v}`.trim() !== ''),
    ),
  ];

  const coloniaIds = [
    ...new Set(
      items
        .map((x) => x?.colonia)
        .filter((v) => v !== null && v !== undefined && `${v}`.trim() !== ''),
    ),
  ];

  const cpIds = [
    ...new Set(
      items
        .map((x) => x?.codigoPostal)
        .filter((v) => v !== null && v !== undefined && `${v}`.trim() !== ''),
    ),
  ];

  const [calles, colonias, cps] = await Promise.all([
    calleIds.length
      ? this.streetRepo.find({
          where: { id: In(calleIds as any) },
        })
      : [],
    coloniaIds.length
      ? this.coloniaRepo.find({
          where: { id: In(coloniaIds as any) },
        })
      : [],
    cpIds.length
      ? this.postalCodeRepo.find({
          where: { id: In(cpIds as any) },
        })
      : [],
  ]);

  const callesMap = new Map<string, Street>(
    calles.map((item): [string, Street] => [String(item.id), item]),
  );

  const coloniasMap = new Map<string, Colonia>(
    colonias.map((item): [string, Colonia] => [String(item.id), item]),
  );

  const cpMap = new Map<string, PostalCode>(
    cps.map((item): [string, PostalCode] => [String(item.id), item]),
  );

  return items.map((item) => {
    const calleObj = callesMap.get(String(item.calle));
    const coloniaObj = coloniasMap.get(String(item.colonia));
    const cpObj = cpMap.get(String(item.codigoPostal));

    return {
      ...item,
      calleNombre: calleObj?.nombre ?? item.calle,
      coloniaNombre: coloniaObj?.nombre ?? item.colonia,
      codigoPostalNombre: cpObj?.codigo_postal ?? item.codigoPostal,
    };
  });
}
}