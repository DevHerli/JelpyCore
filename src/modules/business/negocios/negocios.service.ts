import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Negocio } from './entities/negocio.entity';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';
import {
  ESTADOS_NEGOCIO,
  LIMITE_NEGOCIOS_POR_MEMBRESIA,
} from '../../../common/constants/negocios.constants';

@Injectable()
export class NegociosService {
  constructor(
    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
  ) {}

  async listar(): Promise<Negocio[]> {
    return this.negocioRepo.find({
      where: { eliminado: false },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
      ],
      order: { nombreNegocio: 'ASC' },
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
        'estado',
        'ciudad',
        'sucursales',
      ],
    });

    if (!negocio) {
      throw new NotFoundException('Negocio no encontrado');
    }

    return negocio;
  }

  async listarPorSuscriptor(suscriptorId: number): Promise<Negocio[]> {
    return this.negocioRepo.find({
      where: { suscriptor: { id: suscriptorId }, eliminado: false },
      relations: [
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
      ],
      order: { id: 'ASC' },
    });
  }

  async crear(dto: CreateNegocioDto): Promise<Negocio> {
    // 1. Obtener suscriptor real (aquí sí viene membresía)
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id: dto.suscriptorId },
      relations: ['membresia'],
    });

    if (!suscriptor) {
      throw new NotFoundException('Suscriptor no encontrado');
    }

    // 2. Contar cuántos negocios tiene
    const totalNegocios = await this.negocioRepo.count({
      where: { suscriptor: { id: suscriptor.id }, eliminado: false },
    });

    // 3. Obtener límite permitido según membresía
    const membresiaNombre = suscriptor.membresia?.nombre?.toLowerCase() || 'gratuita';
    const limite = LIMITE_NEGOCIOS_POR_MEMBRESIA[membresiaNombre] ?? 1;

    if (totalNegocios >= limite) {
      throw new BadRequestException(
        `Tu membresía (${suscriptor.membresia.nombre}) permite registrar hasta ${limite} negocio(s).`,
      );
    }

    // 4. Estado inicial
    const estadoInicial = ESTADOS_NEGOCIO.ACTIVA;

    // 5. Crear negocio con relaciones
    const nuevo = this.negocioRepo.create({
      ...dto,
      suscriptor: { id: suscriptor.id } as any,
      categoria: { id: dto.categoriaId } as any,
      subcategoria: dto.subcategoriaId
        ? ({ id: dto.subcategoriaId } as any)
        : undefined,
      especialidad: dto.especialidadId
        ? ({ id: dto.especialidadId } as any)
        : undefined,
      ciudad: { id: dto.ciudadId } as any,
      estado: { id: estadoInicial } as any,
      logoUrl: dto.logoUrl || null,
    });

    const guardado = await this.negocioRepo.save(nuevo);

    // 6. Actualizar tieneNegocios
    await this.suscriptorRepo.update(suscriptor.id, { tieneNegocios: true });

    // 7. Devolver negocio completo
    return this.negocioRepo.findOne({
      where: { id: guardado.id },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
      ],
    });
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
  
  async obtenerDetalle(id: number) {
    const negocio = await this.negocioRepo.findOne({
      where: { id, eliminado: false },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'estado',
        'ciudad',
        'sucursales',
        'sucursales.ciudad',
        'sucursales.estado',
      ],
    });

    if (!negocio) {
      throw new NotFoundException(`No se encontró el negocio con id ${id}`);
    }

    const resumen = {
      totalSucursales: negocio.sucursales?.length || 0,
      estado: negocio.estado?.nombre || 'Desconocido',
      fechaRegistro: negocio.fechaRegistro,
      ultimaActualizacion: negocio.fechaActualizacion,
    };

    return { negocio, resumen };
  }
}
