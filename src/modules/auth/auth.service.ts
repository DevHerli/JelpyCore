import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Not } from 'typeorm';
import { CodigoOtp } from './entities/codigo-otp.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';

import { SendOtpRegisterDto } from './dtos/send-otp-register.dto';
import { VerifyOtpRegisterDto } from './dtos/verify-otp-register.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';

import { LoginEmailDto } from './dtos/login-email.dto';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(CodigoOtp)
    private readonly otpRepo: Repository<CodigoOtp>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async loginEmail(dto: LoginEmailDto) {
    const { correoElectronico, contrasena } = dto;

    if (!correoElectronico || !contrasena) {
      throw new BadRequestException('Correo y contraseña son obligatorios.');
    }

    const suscriptor = await this.suscriptorRepo.findOne({
      where: { correoElectronico, eliminado: false },
    });

    if (!suscriptor) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    if (!suscriptor.contrasena) {
      throw new UnauthorizedException(
        'Esta cuenta no tiene contraseña configurada. Debes completar tu perfil.'
      );
    }

    const valido = await bcrypt.compare(contrasena, suscriptor.contrasena);
    if (!valido) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    // JWT payload
    const payload = {
      sub: suscriptor.id,
      correo: suscriptor.correoElectronico,
      nombre: suscriptor.nombre,
      apellidoPaterno: suscriptor.apellidoPaterno,
      registroCompleto: suscriptor.registroCompleto,
      tieneNegocios: suscriptor.tieneNegocios,
    };

    // Tokens
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: suscriptor.id },
      { expiresIn: '30d' },
    );

    suscriptor.refreshToken = await bcrypt.hash(refreshToken, 10);
    suscriptor.ultimoLogin = new Date();
    await this.suscriptorRepo.save(suscriptor);

    return {
      success: true,
      message: 'Login exitoso.',
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: suscriptor.id,
        nombre: suscriptor.nombre,
        apellidoPaterno: suscriptor.apellidoPaterno,
        correoElectronico: suscriptor.correoElectronico,
        telefonoCelular: suscriptor.telefonoCelular,
        registroCompleto: suscriptor.registroCompleto,
        tieneNegocios: suscriptor.tieneNegocios,
      },
    };
  }



  async sendOtpRegister(dto: SendOtpRegisterDto) {
    const existente = await this.suscriptorRepo.findOne({
      where: { telefonoCelular: dto.telefonoCelular, eliminado: false },
    });
    if (existente) {
      throw new BadRequestException('El teléfono ya está registrado.');
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    const otp = this.otpRepo.create({
      telefonoCelular: dto.telefonoCelular,
      codigo,
      expiracion,
      datosRegistro: dto,
    });

    await this.otpRepo.save(otp);

    return {
      success: true,
      message: 'OTP enviado correctamente (simulado).',
    };
  }

  async verifyOtpRegister(dto: VerifyOtpRegisterDto) {
    const now = new Date();

    const otp = await this.otpRepo.findOne({
      where: {
        telefonoCelular: dto.telefonoCelular,
        codigo: dto.codigo,
        usado: false,
        expiracion: MoreThan(now),
      },
    });

    if (!otp) {
      throw new UnauthorizedException('Código inválido o expirado.');
    }

    otp.usado = true;
    await this.otpRepo.save(otp);

    const datos = otp.datosRegistro;
    if (!datos) {
      throw new BadRequestException('No se encontraron los datos del registro.');
    }

    const nuevo = this.suscriptorRepo.create({
      nombre: datos.nombre,
      apellidoPaterno: datos.apellidoPaterno,
      telefonoCelular: datos.telefonoCelular,
      aceptoTerminos: datos.aceptoTerminos,
      ciudad: { id: datos.ciudadId } as any,
      registroCompleto: false,
      tieneNegocios: false,
    });

    const suscriptor = await this.suscriptorRepo.save(nuevo);

    return {
      success: true,
      message: 'Registro confirmado.',
      subscriber: suscriptor,
    };
  }

  async sendOtp(dto: SendOtpDto) {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        telefonoCelular: dto.phoneNumber,
        codigo,
        expiracion,
      })
    );

    console.log(`OTP (simulado): ${codigo}`);

    return { success: true, message: 'OTP generado.' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const now = new Date();

    const otp = await this.otpRepo.findOne({
      where: {
        telefonoCelular: dto.phoneNumber,
        codigo: dto.code,
        usado: false,
        expiracion: MoreThan(now),
      },
    });

    if (!otp) {
      throw new UnauthorizedException('Código inválido o expirado.');
    }

    otp.usado = true;
    await this.otpRepo.save(otp);

    let suscriptor = await this.suscriptorRepo.findOne({
      where: { telefonoCelular: dto.phoneNumber },
    });

    if (!suscriptor) {
      suscriptor = await this.suscriptorRepo.save(
        this.suscriptorRepo.create({
          nombre: 'Pendiente',
          apellidoPaterno: 'Por registrar',
          telefonoCelular: dto.phoneNumber,
          registroCompleto: false,
          ciudad: { id: 1 } as any,
        })
      );
    }

    const payload = {
      sub: suscriptor.id,
      telefono: suscriptor.telefonoCelular,
      nombre: suscriptor.nombre,
      apellidoPaterno: suscriptor.apellidoPaterno,
      registroCompleto: suscriptor.registroCompleto,
      tieneNegocios: suscriptor.tieneNegocios,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: suscriptor.id },
      { expiresIn: '30d' }
    );

    suscriptor.refreshToken = await bcrypt.hash(refreshToken, 10);
    await this.suscriptorRepo.save(suscriptor);

    return {
      success: true,
      message: 'OTP verificado.',
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Falta refresh token');
    }
  
    try {
      const decoded = this.jwtService.verify(refreshToken);
  
      const suscriptor = await this.suscriptorRepo.findOne({
        where: { id: decoded.sub },
      });
  
      if (!suscriptor || !suscriptor.refreshToken) {
        throw new UnauthorizedException('Refresh token inválido');
      }
  
      const isValid = await bcrypt.compare(
        refreshToken,
        suscriptor.refreshToken,
      );
  
      if (!isValid) {
        throw new UnauthorizedException('Refresh token no válido');
      }
  
      //TOKEN COMPLETO (IMPORTANTE)
      const payload = {
        sub: suscriptor.id,
        correo: suscriptor.correoElectronico,
        nombre: suscriptor.nombre,
        apellidoPaterno: suscriptor.apellidoPaterno,
        registroCompleto: suscriptor.registroCompleto,
        tieneNegocios: suscriptor.tieneNegocios,
      };
  
      const newAccess = this.jwtService.sign(payload, {
        expiresIn: '10m',
      });
  
      return {
        success: true,
        access_token: newAccess,
        refresh_token: refreshToken, // opcional mantener el mismo
      };
    } catch {
      throw new UnauthorizedException('Refresh token expirado o inválido');
    }
  }
  

  async logout(id: number) {
    await this.suscriptorRepo.update(id, { refreshToken: null });
    return { success: true, message: 'Sesión cerrada.' };
  }
}
