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
import { DatosFiscalesDto } from './dto/datos-fiscales.dto';
import { UpdatePermisosDto } from './dto/update-permisos.dto';

import * as bcrypt from 'bcryptjs';
import { Membresia } from '../membresias/entities/membresia.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SuscriptoresService {
  constructor(
    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    // Necesario para obtener datos de la membresía
    @InjectRepository(Membresia)
    private readonly membresiaRepo: Repository<Membresia>,

    private readonly jwtService: JwtService

  ) {}

  async listar(): Promise<Suscriptor[]> {
    return this.suscriptorRepo.find({
      where: { eliminado: false },
      order: { nombre: 'ASC' },
    });
  }

  async obtenerPorId(id: number): Promise<Suscriptor> {
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id, eliminado: false },
      relations: ['membresia', 'ciudad', 'estado'],
    });

    if (!suscriptor) {
      throw new NotFoundException('Suscriptor no encontrado');
    }

    return suscriptor;
  }

  async crear(dto: CreateSuscriptorDto): Promise<Suscriptor> {
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

    const nuevo = this.suscriptorRepo.create({
      nombre: dto.nombre,
      apellidoPaterno: dto.apellidoPaterno,
      apellidoMaterno: dto.apellidoMaterno ?? null,
      sexo: dto.sexo ?? null,
      fechaNacimiento: dto.fechaNacimiento
        ? new Date(dto.fechaNacimiento)
        : null,
      correoElectronico: dto.correoElectronico ?? null,
      // BUG 0.1 — el front enviaba telefonoCelular en el registro por correo
      // pero el campo no se mapeaba al create() → se perdía en silencio.
      telefonoCelular: dto.telefonoCelular ?? null,
      aceptoTerminos: dto.aceptoTerminos ? true : false,
      registroCompleto: false,
      tieneNegocios: false,
      ciudad: { id: dto.ciudadId } as any,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : null,
    });

    const guardado = await this.suscriptorRepo.save(nuevo);

    // Guardar contraseña en operación separada (columna select:false)
    // — evita que create() + save() intente escribir el hash en una columna
    //   que TypeORM no incluyó en el snapshot original.
    if (dto.contrasena) {
      await this.suscriptorRepo.update(guardado.id, {
        contrasena: await bcrypt.hash(dto.contrasena, 10),
      } as any);
    }

    return this.obtenerPorId(guardado.id);
  }

  async actualizar(id: number, dto: UpdateSuscriptorDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);

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

    // Excluimos contrasena, ciudadId y estadoId del spread:
    //  - contrasena tiene select:false → actualizarla por separado via update()
    //    para evitar que save() la escriba como undefined (NULL accidental).
    //  - ciudadId/estadoId son IDs numéricos del DTO que no existen en la entidad.
    const { contrasena, ciudadId, estadoId, ...rest } = dto;

    Object.assign(suscriptor, {
      ...rest,
      ciudad: ciudadId ? ({ id: ciudadId } as any) : suscriptor.ciudad,
      estado: estadoId ? ({ id: estadoId } as any) : suscriptor.estado,
    });

    await this.suscriptorRepo.save(suscriptor);

    // Actualizar contraseña en operación separada (columna select:false)
    if (contrasena) {
      await this.suscriptorRepo.update(suscriptor.id, {
        contrasena: await bcrypt.hash(contrasena, 10),
      } as any);
    }

    return this.obtenerPorId(suscriptor.id);
  }

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

  async completarPerfil(id: number, dto: CompletarPerfilDto): Promise<any> {
    const suscriptor = await this.obtenerPorId(id);
  
    // Teléfono (máx 2 cuentas)
    if (dto.telefonoCelular) {
      const count = await this.suscriptorRepo.count({
        where: { telefonoCelular: dto.telefonoCelular, id: Not(id) },
      });
      if (count >= 2) {
        throw new BadRequestException(
          'Este número de teléfono ya está asociado al máximo permitido de 2 cuentas.',
        );
      }
      suscriptor.telefonoCelular = dto.telefonoCelular;
    }
  
    // Validar membresía
    if (!dto.membresiaId) {
      throw new BadRequestException('Debe seleccionar una membresía.');
    }
  
    // Asignar membresía
    suscriptor.membresia = { id: dto.membresiaId } as any;
  
    suscriptor.sexo = dto.sexo;
    suscriptor.fechaNacimiento = new Date(dto.fechaNacimiento);
  
    suscriptor.estado = { id: 1 } as any;
  
    const membresia = await this.membresiaRepo.findOne({
      where: { id: dto.membresiaId },
    });
  
    if (!membresia) {
      throw new BadRequestException('La membresía seleccionada no existe.');
    }
  
    const precio = Number(membresia.precio);
  
    suscriptor.tieneNegocios = precio === 0;
    suscriptor.registroCompleto = true;
  
    const actualizado = await this.suscriptorRepo.save(suscriptor);
  
    // TOKEN NUEVO
    const payload = {
      sub: suscriptor.id,
      nombre: suscriptor.nombre,
      apellidoPaterno: suscriptor.apellidoPaterno,
      correoElectronico: suscriptor.correoElectronico,
      registroCompleto: suscriptor.registroCompleto,
      tieneNegocios: suscriptor.tieneNegocios,
    };
  
    const newToken = this.jwtService.sign(payload, { expiresIn: '15m' });
  
    return {
      success: true,
      message: 'Perfil completado correctamente.',
      access_token: newToken,
      data: await this.obtenerPorId(actualizado.id),
    };
  }
  

  async eliminar(id: number): Promise<void> {
    const suscriptor = await this.obtenerPorId(id);
    suscriptor.eliminado = true;
    await this.suscriptorRepo.save(suscriptor);
  }

  // ── Eliminación lógica de la propia cuenta (vía JWT) ────────────────────

  async eliminarCuenta(suscriptorId: number) {
    const suscriptor = await this.obtenerPorId(suscriptorId);

    suscriptor.eliminado = true;
    suscriptor.fechaEliminacion = new Date();
    suscriptor.refreshToken = null;

    await this.suscriptorRepo.save(suscriptor);

    // Desactivar todos los device tokens del usuario
    await this.suscriptorRepo.manager.query(
      `UPDATE device_tokens SET is_active = 0 WHERE user_id = ?`,
      [suscriptorId],
    );

    // Cancelar suscripciones activas
    await this.suscriptorRepo.manager.query(
      `UPDATE suscriptor_suscripciones
          SET estatus = 'cancelada', fecha_fin = NOW()
        WHERE suscriptor_id = ? AND estatus = 'activa'`,
      [suscriptorId],
    );

    return { ok: true, message: 'Tu cuenta ha sido eliminada correctamente.' };
  }

  // ── Permisos del dispositivo ─────────────────────────────────────────────

  async getPermisos(suscriptorId: number) {
    const s = await this.suscriptorRepo.findOne({
      where: { id: suscriptorId, eliminado: false },
      select: ['id', 'permisoNotificaciones', 'permisoGeolocalizacion', 'permisoUsoDatos'] as any,
    });

    if (!s) throw new NotFoundException('Suscriptor no encontrado');

    return {
      suscriptorId,
      notificaciones: s.permisoNotificaciones ?? null,
      geolocalizacion: s.permisoGeolocalizacion ?? null,
      usoDatos: s.permisoUsoDatos ?? null,
    };
  }

  async updatePermisos(suscriptorId: number, dto: UpdatePermisosDto) {
    const s = await this.suscriptorRepo.findOne({
      where: { id: suscriptorId, eliminado: false },
    });

    if (!s) throw new NotFoundException('Suscriptor no encontrado');

    if (dto.notificaciones !== undefined) s.permisoNotificaciones = dto.notificaciones;
    if (dto.geolocalizacion !== undefined) s.permisoGeolocalizacion = dto.geolocalizacion;
    if (dto.usoDatos !== undefined) s.permisoUsoDatos = dto.usoDatos;

    await this.suscriptorRepo.save(s);

    // Si se revocan las notificaciones, desactivar los device tokens inmediatamente
    if (dto.notificaciones === false) {
      await this.suscriptorRepo.manager.query(
        `UPDATE device_tokens SET is_active = 0 WHERE user_id = ?`,
        [suscriptorId],
      );
    }

    return this.getPermisos(suscriptorId);
  }

  // ── Datos fiscales ────────────────────────────────────────────────────────

  async getDatosFiscales(id: number) {
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id, eliminado: false },
      select: ['id', 'rfc', 'razonSocial', 'usoCfdi', 'regimenFiscal', 'codigoPostalFiscal', 'emailFiscal'] as any,
    });

    if (!suscriptor) throw new NotFoundException('Suscriptor no encontrado');

    return {
      suscriptorId:       id,
      rfc:                suscriptor.rfc ?? null,
      razonSocial:        suscriptor.razonSocial ?? null,
      usoCfdi:            suscriptor.usoCfdi ?? null,
      regimenFiscal:      suscriptor.regimenFiscal ?? null,
      codigoPostalFiscal: suscriptor.codigoPostalFiscal ?? null,
      emailFiscal:        suscriptor.emailFiscal ?? null,
    };
  }

  async updateDatosFiscales(id: number, dto: DatosFiscalesDto) {
    const suscriptor = await this.suscriptorRepo.findOne({
      where: { id, eliminado: false },
    });

    if (!suscriptor) throw new NotFoundException('Suscriptor no encontrado');

    if (dto.rfc               !== undefined) suscriptor.rfc               = dto.rfc ?? null;
    if (dto.razonSocial       !== undefined) suscriptor.razonSocial       = dto.razonSocial ?? null;
    if (dto.usoCfdi           !== undefined) suscriptor.usoCfdi           = dto.usoCfdi ?? null;
    if (dto.regimenFiscal     !== undefined) suscriptor.regimenFiscal     = dto.regimenFiscal ?? null;
    if (dto.codigoPostalFiscal !== undefined) suscriptor.codigoPostalFiscal = dto.codigoPostalFiscal ?? null;
    if (dto.emailFiscal       !== undefined) suscriptor.emailFiscal       = dto.emailFiscal ?? null;

    await this.suscriptorRepo.save(suscriptor);

    return this.getDatosFiscales(id);
  }
}
