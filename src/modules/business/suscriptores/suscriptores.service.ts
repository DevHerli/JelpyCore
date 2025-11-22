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
      aceptoTerminos: dto.aceptoTerminos ? true : false,
      registroCompleto: false,
      tieneNegocios: false,
      ciudad: { id: dto.ciudadId } as any,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : null,
    });

    if (dto.contrasena) {
      nuevo.contrasena = await bcrypt.hash(dto.contrasena, 10);
    }

    const guardado = await this.suscriptorRepo.save(nuevo);
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

    Object.assign(suscriptor, {
      ...dto,
      ciudad: dto.ciudadId
        ? ({ id: dto.ciudadId } as any)
        : suscriptor.ciudad,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : suscriptor.estado,
    });

    if (dto.contrasena) {
      suscriptor.contrasena = await bcrypt.hash(dto.contrasena, 10);
    }

    const actualizado = await this.suscriptorRepo.save(suscriptor);
    return this.obtenerPorId(actualizado.id);
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
  
    // 🔥 TOKEN NUEVO
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
}
