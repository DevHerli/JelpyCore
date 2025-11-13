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
import {
  ESTADOS_NEGOCIO,
  LIMITE_NEGOCIOS_POR_MEMBRESIA,
} from '../../../common/constants/negocios.constants';

@Injectable()
export class NegociosService {
  constructor(
    @InjectRepository(Negocio)
    private readonly negocioRepo: Repository<Negocio>,
  ) {}

  // Listar todos los negocios (no eliminados)
  async listar(): Promise<Negocio[]> {
    return this.negocioRepo.find({
      where: { eliminado: false },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'membresia',
        'estado',
        'ciudad',
        'sucursales',
      ],
      order: { nombreNegocio: 'ASC' },
    });
  }

  // Obtener un negocio por ID
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
        'ciudad',
        'sucursales',
      ],
    });
    if (!negocio) throw new NotFoundException('Negocio no encontrado');
    return negocio;
  }

  // Listar negocios por suscriptor
  async listarPorSuscriptor(suscriptorId: number): Promise<Negocio[]> {
    return this.negocioRepo.find({
      where: { suscriptor: { id: suscriptorId }, eliminado: false },
      relations: [
        'categoria',
        'subcategoria',
        'especialidad',
        'membresia',
        'estado',
        'ciudad',
        'sucursales',
      ],
      order: { id: 'ASC' },
    });
  }

  // Crear negocio con control de membresía, pago y estado
  async crear(dto: CreateNegocioDto): Promise<Negocio> {
    // Verificar cuántos negocios tiene el suscriptor
    const negociosActuales = await this.negocioRepo.count({
      where: { suscriptor: { id: dto.suscriptorId }, eliminado: false },
    });

    // Obtener la membresía y su límite
    const membresiaNombre = await this.obtenerNombreMembresia(dto.membresiaId);
    const limite =
      LIMITE_NEGOCIOS_POR_MEMBRESIA[membresiaNombre?.toLowerCase()] ?? 1;

    if (negociosActuales >= limite) {
      throw new BadRequestException(
        `Tu membresía (${membresiaNombre}) permite registrar hasta ${limite} negocio(s).`,
      );
    }

    // Determinar estado inicial
    let estadoInicial = ESTADOS_NEGOCIO.PENDIENTE_PAGO;

    if (membresiaNombre.toLowerCase() === 'free') {
      estadoInicial = ESTADOS_NEGOCIO.ACTIVA;
    } else if (membresiaNombre.toLowerCase() === 'cortesia') {
      estadoInicial = ESTADOS_NEGOCIO.CORTESIA;
    } else {
      // Simulamos el pago
      const pagoExitoso = await this.simularPago(
        dto.membresiaId,
        dto.suscriptorId,
      );
      estadoInicial = pagoExitoso
        ? ESTADOS_NEGOCIO.ACTIVA
        : ESTADOS_NEGOCIO.PENDIENTE_PAGO;
    }

    // Crear el negocio
    const nuevo = this.negocioRepo.create({
      ...dto,
      suscriptor: { id: dto.suscriptorId } as any,
      categoria: dto.categoriaId ? ({ id: dto.categoriaId } as any) : undefined,
      subcategoria: dto.subcategoriaId
        ? ({ id: dto.subcategoriaId } as any)
        : undefined,
      especialidad: dto.especialidadId
        ? ({ id: dto.especialidadId } as any)
        : undefined,
      membresia: dto.membresiaId
        ? ({ id: dto.membresiaId } as any)
        : undefined,
      ciudad: dto.ciudadId ? ({ id: dto.ciudadId } as any) : undefined,
      estado: { id: estadoInicial } as any,
      logoUrl: dto.logoUrl || null,
    });

    const guardado = await this.negocioRepo.save(nuevo);

    // Recargar el negocio con todas sus relaciones completas
    const negocioCompleto = await this.negocioRepo.findOne({
      where: { id: guardado.id },
      relations: [
        'suscriptor',
        'categoria',
        'subcategoria',
        'especialidad',
        'membresia',
        'estado',
        'ciudad',
        'sucursales',
      ],
    });

    return negocioCompleto;
  }

  // Simular proceso de pago (puedes luego reemplazar con Stripe o similar)
  private async simularPago(
    membresiaId: number,
    suscriptorId: number,
  ): Promise<boolean> {
    console.log(
      `Simulando cobro de membresía ${membresiaId} para suscriptor ${suscriptorId}`,
    );
    return Math.random() > 0.2; // 80% éxito
  }

  // Obtener nombre de membresía (consulta rápida)
  private async obtenerNombreMembresia(membresiaId: number): Promise<string> {
    const result = await this.negocioRepo.query(
      `SELECT nombre FROM membresias WHERE id = ? LIMIT 1`,
      [membresiaId],
    );
    return result?.[0]?.nombre || 'free';
  }

  // Actualizar un negocio
  async actualizar(id: number, dto: UpdateNegocioDto): Promise<Negocio> {
    const negocio = await this.obtenerPorId(id);
    Object.assign(negocio, dto);
    return this.negocioRepo.save(negocio);
  }

  // Eliminar (marcar como eliminado)
  async eliminar(id: number): Promise<void> {
    const negocio = await this.obtenerPorId(id);
    negocio.eliminado = true;
    await this.negocioRepo.save(negocio);
  }

  // Obtener detalle completo (para dashboard o vista ampliada)
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
      tipoMembresia: negocio.membresia?.nombre || 'Sin membresía',
      estado: negocio.estado?.nombre || 'Desconocido',
      fechaRegistro: negocio.fechaRegistro,
      ultimaActualizacion: negocio.fechaActualizacion,
    };

    return { negocio, resumen };
  }
}
