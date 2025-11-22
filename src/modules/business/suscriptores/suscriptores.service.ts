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

@Injectable()
export class SuscriptoresService {
  constructor(
    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    //Necesario para obtener datos de la membresía
    @InjectRepository(Membresia)
    private readonly membresiaRepo: Repository<Membresia>,
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
    });

    if (!suscriptor) {
      throw new NotFoundException('Suscriptor no encontrado');
    }

    return suscriptor;
  }


  async crear(dto: CreateSuscriptorDto): Promise<Suscriptor> {
    // Validar duplicado de correo
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

    // Encriptar contraseña si viene
    if (dto.contrasena) {
      nuevo.contrasena = await bcrypt.hash(dto.contrasena, 10);
    }

    const guardado = await this.suscriptorRepo.save(nuevo);
    return this.obtenerPorId(guardado.id);
  }


  async actualizar(id: number, dto: UpdateSuscriptorDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);

    /** Validar teléfono duplicado */
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

    /** Encriptar contraseña si la cambia */
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


  async completarPerfil(id: number, dto: CompletarPerfilDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);


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

 
    if (!dto.membresiaId) {
      throw new BadRequestException('Debe seleccionar una membresía.');
    }

    // Asignar relación ManyToOne
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

    const nombre = membresia.nombre.toLowerCase();

    if (nombre === 'free' || nombre === 'gratis' || membresia.precio === 0) {
      suscriptor.tieneNegocios = true; 
    } else {
      suscriptor.tieneNegocios = false; 
    }


    suscriptor.registroCompleto = true;

    /** Guardar */
    const actualizado = await this.suscriptorRepo.save(suscriptor);
    return this.obtenerPorId(actualizado.id);
  }


  async eliminar(id: number): Promise<void> {
    const suscriptor = await this.obtenerPorId(id);
    suscriptor.eliminado = true;
    await this.suscriptorRepo.save(suscriptor);
  }
}
