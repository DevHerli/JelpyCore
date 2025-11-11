import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Suscriptor } from './entities/suscriptores.entity';
import { CreateSuscriptorDto } from './dto/create-suscriptor.dto';
import { UpdateSuscriptorDto } from './dto/update-suscriptor.dto';
import { CompletarPerfilDto } from './dto/completar-perfil.dto';

@Injectable()
export class SuscriptoresService {
  constructor(
    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
  ) {}

  /**
   * Listar todos los suscriptores activos
   */
  async listar(): Promise<Suscriptor[]> {
    return this.suscriptorRepo.find({
      where: { eliminado: false },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Obtener un suscriptor por su ID
   */
  async obtenerPorId(id: number): Promise<Suscriptor> {
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id, eliminado: false },
    });

    if (!suscriptor) {
      throw new NotFoundException('Suscriptor no encontrado');
    }

    return suscriptor;
  }

  /**
   * Crear nuevo suscriptor (primer paso del registro)
   */
  async crear(dto: CreateSuscriptorDto): Promise<Suscriptor> {
    // Validar duplicados de teléfono
    const existeTelefono = await this.suscriptorRepo.findOne({
      where: { telefonoCelular: dto.telefonoCelular },
    });
    if (existeTelefono) {
      throw new BadRequestException('El número de teléfono ya está registrado.');
    }

    // Validar duplicados de correo (solo si se envía)
    if (dto.correoElectronico) {
      const existeCorreo = await this.suscriptorRepo.findOne({
        where: { correoElectronico: dto.correoElectronico },
      });
      if (existeCorreo) {
        throw new BadRequestException('El correo electrónico ya está registrado.');
      }
    }

    // Crear entidad base
    const nuevo = this.suscriptorRepo.create({
      nombre: dto.nombre,
      apellidoPaterno: dto.apellidoPaterno,
      apellidoMaterno: dto.apellidoMaterno ?? null,
      sexo: dto.sexo ?? null,
      fechaNacimiento: dto.fechaNacimiento
        ? new Date(dto.fechaNacimiento)
        : null,
      telefonoCelular: dto.telefonoCelular,
      correoElectronico: dto.correoElectronico ?? null,
      contrasena: dto.contrasena ?? null,
      aceptoTerminos: dto.aceptoTerminos ? true : false,
      registroCompleto: false, // Inicia incompleto
      tieneNegocios: false, // Sin negocios al inicio
      ciudad: { id: dto.ciudadId } as any,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : null,
    });

    const guardado = await this.suscriptorRepo.save(nuevo);
    return this.obtenerPorId(guardado.id);
  }

  /**
   * Actualizar datos del suscriptor (para completar registro)
   */
  async actualizar(id: number, dto: UpdateSuscriptorDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);

    // Validar duplicado de correo
    if (
      dto.correoElectronico &&
      dto.correoElectronico !== suscriptor.correoElectronico
    ) {
      const existente = await this.suscriptorRepo.findOne({
        where: { correoElectronico: dto.correoElectronico, id: Not(id) },
      });
      if (existente) {
        throw new BadRequestException(
          'El correo electrónico ya está registrado por otro suscriptor.',
        );
      }
    }

    // Validar duplicado de teléfono
    if (
      dto.telefonoCelular &&
      dto.telefonoCelular !== suscriptor.telefonoCelular
    ) {
      const existente = await this.suscriptorRepo.findOne({
        where: { telefonoCelular: dto.telefonoCelular, id: Not(id) },
      });
      if (existente) {
        throw new BadRequestException(
          'El número de teléfono ya está registrado por otro suscriptor.',
        );
      }
    }

    // Asignar nuevos valores
    Object.assign(suscriptor, {
      ...dto,
      ciudad: dto.ciudadId
        ? ({ id: dto.ciudadId } as any)
        : suscriptor.ciudad,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : suscriptor.estado,
    });

    // Verificar si ya completó los datos esenciales
    if (
      dto.sexo &&
      dto.fechaNacimiento &&
      dto.correoElectronico &&
      dto.contrasena
    ) {
      suscriptor.registroCompleto = true;
    }

    const actualizado = await this.suscriptorRepo.save(suscriptor);
    return this.obtenerPorId(actualizado.id);
  }

  /**
   * Marcar un suscriptor como "registro completo"
   */
  async completarRegistro(id: number): Promise<{
    success: boolean;
    message: string;
    data: Suscriptor;
  }> {
    const suscriptor = await this.obtenerPorId(id);

    if (suscriptor.registroCompleto) {
      return {
        success: true,
        message: 'El registro ya estaba completo.',
        data: suscriptor,
      };
    }

    suscriptor.registroCompleto = true;
    await this.suscriptorRepo.save(suscriptor);

    return {
      success: true,
      message: 'Registro marcado como completo correctamente.',
      data: suscriptor,
    };
  }

  /**
   * Eliminar (soft delete)
   */
  async eliminar(id: number): Promise<void> {
    const suscriptor = await this.obtenerPorId(id);
    suscriptor.eliminado = true;
    await this.suscriptorRepo.save(suscriptor);
  }

/**
 * Completar o actualizar perfil desde app móvil
 * correo y contraseña son opcionales, pero recomendados.
 */
async completarPerfil(id: number, dto: CompletarPerfilDto): Promise<Suscriptor> {
  const suscriptor = await this.obtenerPorId(id);

  // Validar correo duplicado solo si se envía y es diferente
  if (dto.correoElectronico && dto.correoElectronico !== suscriptor.correoElectronico) {
    const existeCorreo = await this.suscriptorRepo.findOne({
      where: { correoElectronico: dto.correoElectronico, id: Not(id) },
    });
    if (existeCorreo) {
      throw new BadRequestException('El correo electrónico ya está registrado.');
    }
  }

  // Actualizar campos opcionales (solo los enviados)
  Object.assign(suscriptor, {
    sexo: dto.sexo ?? suscriptor.sexo,
    fechaNacimiento: dto.fechaNacimiento
      ? new Date(dto.fechaNacimiento)
      : suscriptor.fechaNacimiento,
    correoElectronico: dto.correoElectronico ?? suscriptor.correoElectronico,
    contrasena: dto.contrasena ?? suscriptor.contrasena,
  });

  // Si ya tiene los datos mínimos, marcar como completo (si no lo estaba)
  if (!suscriptor.registroCompleto && suscriptor.sexo && suscriptor.fechaNacimiento) {
    suscriptor.registroCompleto = true;
  }

  const actualizado = await this.suscriptorRepo.save(suscriptor);

  // Mensaje informativo
  const message =
    !actualizado.correoElectronico || !actualizado.contrasena
      ? 'Perfil actualizado correctamente. Se recomienda agregar correo y contraseña para un mejor control de su cuenta.'
      : 'Perfil completado y actualizado correctamente.';

  return {
    ...actualizado,
    message,
  } as any;
}

  
}
