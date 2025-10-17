import { Injectable, NotFoundException } from '@nestjs/common';
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

  async listar(): Promise<Negocio[]> {
    return this.negocioRepo.find({
      where: { eliminado: false },
      order: { nombreNegocio: 'ASC' },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'membresia',
        'estado',
        'sucursales',
    ],
    });
  }

  async obtenerPorId(id: number): Promise<Negocio> {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: [
      'suscriptor',
      'categoria',
      'subcategoria',
      'especialidad',
      'membresia',
      'estado',
      'sucursales',
    ],
    });
    if (!negocio) throw new NotFoundException('Negocio no encontrado');
    return negocio;
  }

async listarPorSuscriptor(suscriptorId: number): Promise<Negocio[]> {
  return this.negocioRepo.find({
    where: {
      suscriptor: { id: suscriptorId },
      eliminado: false,
    },
    relations: [
      'categoria',
      'subcategoria',
    //   'subcategoria.categoria',
      'especialidad',
      'membresia',
      'estado',
      'sucursales',
    ],
    order: { id: 'ASC' },
  });
}


  async obtenerDetalle(id: number) {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'membresia',
        'estado',
        'sucursales',
        'sucursales.ciudad',
        'sucursales.estado',
      ],
    });

    if (!negocio) {
      throw new NotFoundException(`No se encontró el negocio con id ${id}`);
    }

    // 📊 Resumen para dashboard
    const resumen = {
      totalSucursales: negocio.sucursales?.length || 0,
      tipoMembresia: negocio.membresia?.nombre || 'Sin membresía',
      estado: negocio.estado?.nombre || 'Desconocido',
      fechaRegistro: negocio.fechaRegistro,
      ultimaActualizacion: negocio.fechaActualizacion,
    };

    return {
      negocio,
      resumen,
    };
  }




async crear(dto: CreateNegocioDto): Promise<Negocio> {
  const nuevo: Negocio = this.negocioRepo.create({
    ...dto,
    suscriptor: { id: dto.suscriptorId } as any,
    categoria: dto.categoriaId ? ({ id: dto.categoriaId } as any) : undefined,
    subcategoria: dto.subcategoriaId ? ({ id: dto.subcategoriaId } as any) : undefined,
    especialidad: dto.especialidadId ? ({ id: dto.especialidadId } as any) : undefined,
    membresia: dto.membresiaId ? ({ id: dto.membresiaId } as any) : undefined,
    estado: dto.estadoId ? ({ id: dto.estadoId } as any) : undefined,
    ciudad: dto.ciudadId ? ({ id: dto.ciudadId } as any) : undefined,
  });

  const guardado = await this.negocioRepo.save(nuevo);
  return guardado;
}


  async actualizar(id: number, dto: UpdateNegocioDto): Promise<Negocio> {
    const negocio = await this.obtenerPorId(id);
    Object.assign(negocio, dto);
    return this.negocioRepo.save(negocio);
  }

  async eliminar(id: number): Promise<void> {
    const negocio = await this.obtenerPorId(id);
    negocio.eliminado = true;
    await this.negocioRepo.save(negocio);
  }



}
