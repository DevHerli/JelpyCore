import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Suscriptor } from './entities/suscriptores.entity';
import { CreateSuscriptorDto } from './dto/create-suscriptor.dto';
import { UpdateSuscriptorDto } from './dto/update-suscriptor.dto';

@Injectable()
export class SuscriptoresService {
  constructor(
    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
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
    if (!suscriptor) throw new NotFoundException('Suscriptor no encontrado');
    return suscriptor;
  }

  async crear(dto: CreateSuscriptorDto): Promise<Suscriptor> {
    // Validar duplicados
    const existeCorreo = await this.suscriptorRepo.findOne({
      where: { correoElectronico: dto.correoElectronico },
    });
    if (existeCorreo) {
      throw new BadRequestException('El correo ya está registrado');
    }

    const existeTelefono = await this.suscriptorRepo.findOne({
      where: { telefonoCelular: dto.telefonoCelular },
    });
    if (existeTelefono) {
      throw new BadRequestException('El teléfono ya está registrado');
    }

    const nuevo = this.suscriptorRepo.create({
      ...dto,
      ciudad: { id: dto.ciudadId } as any,
      estado: dto.estadoId ? ({ id: dto.estadoId } as any) : null,
    });

    return this.suscriptorRepo.save(nuevo);
  }

  async actualizar(id: number, dto: UpdateSuscriptorDto): Promise<Suscriptor> {
    const suscriptor = await this.obtenerPorId(id);

    // Validar correo duplicado (ignorando el actual)
    if (dto.correoElectronico && dto.correoElectronico !== suscriptor.correoElectronico) {
      const existente = await this.suscriptorRepo.findOne({
        where: { correoElectronico: dto.correoElectronico, id: Not(id) },
      });
      if (existente) {
        throw new BadRequestException('El correo ya está registrado por otro suscriptor');
      }
    }

    // Validar teléfono duplicado (ignorando el actual)
    if (dto.telefonoCelular && dto.telefonoCelular !== suscriptor.telefonoCelular) {
      const existente = await this.suscriptorRepo.findOne({
        where: { telefonoCelular: dto.telefonoCelular, id: Not(id) },
      });
      if (existente) {
        throw new BadRequestException('El teléfono ya está registrado por otro suscriptor');
      }
    }

    Object.assign(suscriptor, dto);

    return this.suscriptorRepo.save(suscriptor);
  }

  async eliminar(id: number): Promise<void> {
    const suscriptor = await this.obtenerPorId(id);
    suscriptor.eliminado = true;
    await this.suscriptorRepo.save(suscriptor);
  }
}
