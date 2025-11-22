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
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SuscriptoresService {
  constructor(
    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
  ) {}

  /** ============================
   *  LISTAR SUSCRIPTORES ACTIVOS
   *  ============================ */
  async listar(): Promise<Suscriptor[]> {
    return this.suscriptorRepo.find({
      where: { eliminado: false },
      order: { nombre: 'ASC' },
    });
  }

  /** ============================
   *  OBTENER POR ID
   *  ============================ */
  async obtenerPorId(id: number): Promise<Suscriptor> {
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id, eliminado: false },
    });

    if (!suscriptor) {
      throw new NotFoundException('Suscriptor no encontrado');
    }

    return suscriptor;
  }

  /** =====================================================
   *  CREAR — PRIMER PASO DEL REGISTRO
   *  Registro inicial AHORA es por correo + contraseña
   *  (teléfono se agrega después en completarPerfil)
   *  ===================================================== */
  async crear(dto: CreateSuscriptorDto): Promise<Suscriptor> {
    // Validar duplicado de correo (si viene)
    if (dto.correoElectronico) {
      const existeCorreo = await this.suscriptorRepo.findOne({
        where: { correoElectronico: dto.correoElectronico },
      });

      if (existeCorreo) {
        throw new BadRequestException(
          'El correo electrónico ya está registrado.',
        );
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
      correoElectronico: dto.correoElectronico ?? null,
      aceptoTerminos: dto.aceptoTerminos ? true : false,
      registroCompleto: false,
      tieneNegocios: false,
      ciudad: { id: dto.ciudadId } as any,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : null,
    });

    // Encriptar contraseña si viene en el registro inicial
    if (dto.contrasena) {
      nuevo.contrasena = await bcrypt.hash(dto.contrasena, 10);
    }

    const guardado = await this.suscriptorRepo.save(nuevo);
    return this.obtenerPorId(guardado.id);
  }

  /** =====================================================
   *  ACTUALIZAR — USO GENERAL / PANEL ADMIN
   *  Regla: máximo 2 cuentas por teléfono
   *  (si el admin o sistema decide agregar teléfono aquí)
   *  ===================================================== */
  async actualizar(id: number, dto: UpdateSuscriptorDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);

    /** Validar teléfono duplicado con máximo 2 cuentas */
    if (dto.telefonoCelular && dto.telefonoCelular !== suscriptor.telefonoCelular) {
      const count = await this.suscriptorRepo.count({
        where: { telefonoCelular: dto.telefonoCelular, id: Not(id) },
      });

      if (count >= 2) {
        throw new BadRequestException(
          'Este número de teléfono ya está asociado al máximo permitido de 2 cuentas.',
        );
      }
    }

    /** Validar correo duplicado */
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

    /** Asignar valores base */
    Object.assign(suscriptor, {
      ...dto,
      ciudad: dto.ciudadId
        ? ({ id: dto.ciudadId } as any)
        : suscriptor.ciudad,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : suscriptor.estado,
    });

    /** Si en algún punto se permite cambiar contraseña desde UpdateSuscriptorDto */
    if (dto.contrasena) {
      suscriptor.contrasena = await bcrypt.hash(dto.contrasena, 10);
    }

    const actualizado = await this.suscriptorRepo.save(suscriptor);
    return this.obtenerPorId(actualizado.id);
  }

  /** ==========================================
   *  MARCAR REGISTRO COMPLETO (bandera simple)
   *  ========================================== */
  async completarRegistro(id: number) {
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
      message: 'Registro marcado como completo.',
      data: suscriptor,
    };
  }

  /** =====================================================
   *  COMPLETAR PERFIL — APP MÓVIL
   *  Reglas:
   *   - Debe registrar teléfono (máx. 2 cuentas por número)
   *   - Debe elegir membresía (obligatorio)
   *   - NO toca la contraseña
   *  ===================================================== */
  async completarPerfil(id: number, dto: CompletarPerfilDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);

    /** Validar teléfono máximo 2 cuentas */
    if (dto.telefonoCelular) {
      const count = await this.suscriptorRepo.count({
        where: {
          telefonoCelular: dto.telefonoCelular,
          id: Not(id),
        },
      });

      if (count >= 2) {
        throw new BadRequestException(
          'Este número de teléfono ya está asociado al máximo permitido de 2 cuentas.',
        );
      }

      suscriptor.telefonoCelular = dto.telefonoCelular;
    }

    /** Validar que seleccione membresía */
    if (!dto.membresiaId) {
      throw new BadRequestException('Debe seleccionar una membresía.');
    }

    // Relación a la tabla de membresías (ManyToOne en el entity)
    suscriptor.membresia = { id: dto.membresiaId } as any;

    /** Actualizar datos adicionales */
    suscriptor.sexo = dto.sexo ?? suscriptor.sexo;
    suscriptor.fechaNacimiento = dto.fechaNacimiento
      ? new Date(dto.fechaNacimiento)
      : suscriptor.fechaNacimiento;

    /** Marcar registro como completo */
    suscriptor.registroCompleto = true;

    const actualizado = await this.suscriptorRepo.save(suscriptor);
    return this.obtenerPorId(actualizado.id);
  }

  /** =======================
   *  ELIMINAR (SOFT DELETE)
   *  ======================= */
  async eliminar(id: number): Promise<void> {
    const suscriptor = await this.obtenerPorId(id);
    suscriptor.eliminado = true;
    await this.suscriptorRepo.save(suscriptor);
  }
}
