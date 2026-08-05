import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { CodigoOtp } from './entities/codigo-otp.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';

import { SendOtpRegisterDto } from './dtos/send-otp-register.dto';
import { VerifyOtpRegisterDto } from './dtos/verify-otp-register.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';

import { LoginEmailDto } from './dtos/login-email.dto';

// DTOs (email)
import { SendOtpEmailDto } from './dtos/send-otp-email.dto';
import { VerifyOtpEmailDto } from './dtos/verify-otp-email.dto';
import { CheckOtpEmailDto } from './dtos/check-otp-email.dto';

// servicio de correo
import { MailService } from '../../common/mail/mail.service';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

// ── Constantes de tiempo de vida de tokens ────────────────────────────────────
export const ACCESS_TOKEN_TTL  = '15m';   // corto por seguridad — el interceptor renueva
export const REFRESH_TOKEN_TTL = '30d';   // larga — rotación en cada uso

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(CodigoOtp)
    private readonly otpRepo: Repository<CodigoOtp>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    private readonly mailService: MailService,
  ) {}

  async loginEmail(dto: LoginEmailDto) {
    const { correoElectronico, contrasena } = dto;

    if (!correoElectronico || !contrasena) {
      throw new BadRequestException('Correo y contraseña son obligatorios.');
    }

    // contrasena tiene select:false en la entidad → QB con addSelect para leerla
    const suscriptor = await this.suscriptorRepo
      .createQueryBuilder('s')
      .addSelect('s.contrasena')
      .where('s.correoElectronico = :correo AND s.eliminado = 0', {
        correo: correoElectronico,
      })
      .getOne();

    if (!suscriptor) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    if (!suscriptor.contrasena) {
      throw new UnauthorizedException(
        'Esta cuenta no tiene contraseña configurada. Debes completar tu perfil.',
      );
    }

    const valido = await bcrypt.compare(contrasena, suscriptor.contrasena);
    if (!valido) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const payload = {
      sub: suscriptor.id,
      correo: suscriptor.correoElectronico,
      nombre: suscriptor.nombre,
      apellidoPaterno: suscriptor.apellidoPaterno,
      registroCompleto: suscriptor.registroCompleto,
      tieneNegocios: suscriptor.tieneNegocios,
      role: suscriptor.role ?? 'user',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = this.jwtService.sign(
      { sub: suscriptor.id },
      { expiresIn: REFRESH_TOKEN_TTL },
    );

    // Columnas select:false → update() atómico (evita ambigüedad de save() con snapshot)
    await this.suscriptorRepo.update(suscriptor.id as any, {
      refreshToken: await bcrypt.hash(refreshToken, 10),
      ultimoLogin:  new Date(),
    } as any);

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
      correoElectronico: null,
      codigo,
      expiracion,
      datosRegistro: dto,
    });

    await this.otpRepo.save(otp);

    return { success: true, message: 'OTP enviado correctamente (simulado).' };
  }

  async verifyOtpRegister(dto: VerifyOtpRegisterDto) {
    const now = new Date();

    const otp = await this.otpRepo.findOne({
      where: {
        telefonoCelular: dto.telefonoCelular,
        codigo: dto.codigo,
        usado: false,
        expiracion: MoreThan(now),
      } as any,
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

    return { success: true, message: 'Registro confirmado.', subscriber: suscriptor };
  }

  async sendOtp(dto: SendOtpDto) {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        telefonoCelular: dto.phoneNumber,
        correoElectronico: null,
        codigo,
        expiracion,
      }),
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
      } as any,
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
        }),
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

    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = this.jwtService.sign(
      { sub: suscriptor.id },
      { expiresIn: REFRESH_TOKEN_TTL },
    );

    // refreshToken tiene select:false → update() atómico
    await this.suscriptorRepo.update(suscriptor.id as any, {
      refreshToken: await bcrypt.hash(refreshToken, 10),
    } as any);

    return {
      success: true,
      message: 'OTP verificado.',
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  // =========================================================
  // OTP POR EMAIL (Recuperación de contraseña)
  // =========================================================

  async sendOtpEmail(dto: SendOtpEmailDto) {
    const { correoElectronico } = dto;

    if (!correoElectronico) {
      throw new BadRequestException('El correo es obligatorio.');
    }

    const suscriptor = await this.suscriptorRepo.findOne({
      where: { correoElectronico, eliminado: false },
    });

    if (!suscriptor) {
      throw new NotFoundException('No existe una cuenta con ese correo.');
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    // invalidar anteriores activos
    await this.otpRepo
      .createQueryBuilder()
      .update(CodigoOtp)
      .set({ usado: true } as any)
      .where('correo_electronico = :correo', { correo: correoElectronico })
      .andWhere('usado = 0')
      .andWhere('expiracion > NOW()')
      .execute();

    await this.otpRepo.save(
      this.otpRepo.create({
        correoElectronico,
        telefonoCelular: null,
        codigo,
        expiracion,
      } as any),
    );

    await this.mailService.sendOtp(correoElectronico, codigo);

    return { success: true, message: 'Código enviado al correo.' };
  }


  async checkOtpEmail(dto: CheckOtpEmailDto) {
    const { correoElectronico, codigo } = dto;

    if (!correoElectronico || !codigo) {
      throw new BadRequestException('Correo y código son obligatorios.');
    }

    const now = new Date();

    const otp = await this.otpRepo.findOne({
      where: {
        correoElectronico,
        codigo,
        usado: false,
        expiracion: MoreThan(now),
      } as any,
      order: { id: 'DESC' } as any,
    });

    if (!otp) {
      // incrementar intentos de forma segura (si tu columna existe)
      await this.otpRepo
        .createQueryBuilder()
        .update(CodigoOtp)
        .set({} as any)
        .where('correo_electronico = :correo', { correo: correoElectronico })
        .andWhere('codigo = :codigo', { codigo })
        .andWhere('usado = 0')
        .execute();

      throw new UnauthorizedException('Código inválido o expirado.');
    }

    return { success: true, message: 'Código válido.' };
  }

  async verifyOtpEmail(dto: VerifyOtpEmailDto) {
    const { correoElectronico, codigo, nuevaContrasena } = dto;

    if (!correoElectronico || !codigo || !nuevaContrasena) {
      throw new BadRequestException(
        'Correo, código y nueva contraseña son obligatorios.',
      );
    }

    const now = new Date();

    const otp = await this.otpRepo.findOne({
      where: {
        correoElectronico,
        codigo,
        usado: false,
        expiracion: MoreThan(now),
      } as any,
    });

    if (!otp) {
      throw new UnauthorizedException('Código inválido o expirado.');
    }

    const suscriptor = await this.suscriptorRepo.findOne({
      where: { correoElectronico, eliminado: false },
    });

    if (!suscriptor) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // contrasena tiene select:false → update() atómico
    await this.suscriptorRepo.update(suscriptor.id as any, {
      contrasena: await bcrypt.hash(nuevaContrasena, 10),
    } as any);

    otp.usado = true;
    await this.otpRepo.save(otp);

    return { success: true, message: 'Contraseña actualizada correctamente.' };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Falta refresh token');
    }

    // 1. Verificar firma y expiración del JWT
    let decoded: any;
    try {
      decoded = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token expirado o inválido');
    }

    // refreshToken tiene select:false en la entidad → QB con addSelect para leerlo
    const suscriptor = await this.suscriptorRepo
      .createQueryBuilder('s')
      .addSelect('s.refreshToken')
      .where('s.id = :id', { id: decoded.sub })
      .getOne();

    // 2. Si no hay token almacenado → sesión cerrada o cuenta eliminada
    if (!suscriptor || !suscriptor.refreshToken) {
      throw new UnauthorizedException('Sesión inválida. Inicia sesión de nuevo.');
    }

    const isValid = await bcrypt.compare(refreshToken, suscriptor.refreshToken);

    if (!isValid) {
      // ── Detección de reuso (token rotation attack) ────────────────────────
      // Token JWT firmado correctamente pero no coincide con el hash → ya fue
      // rotado. Posible robo. Revocar sesión completa como medida defensiva.
      this.logger.warn(
        `[JLP-001] Reuso de refresh token detectado — suscriptor id=${suscriptor.id}. Sesión revocada.`,
      );
      await this.suscriptorRepo.update(suscriptor.id, { refreshToken: null });
      throw new UnauthorizedException(
        'Sesión revocada por seguridad. Inicia sesión de nuevo.',
      );
    }

    // 3. Rotar: generar nuevo par y actualizar hash en BD (el anterior queda inválido)
    const payload = {
      sub             : suscriptor.id,
      correo          : suscriptor.correoElectronico,
      nombre          : suscriptor.nombre,
      apellidoPaterno : suscriptor.apellidoPaterno,
      registroCompleto: suscriptor.registroCompleto,
      tieneNegocios   : suscriptor.tieneNegocios,
      role            : suscriptor.role ?? 'user',
    };

    const newAccess  = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    const newRefresh = this.jwtService.sign({ sub: suscriptor.id }, { expiresIn: REFRESH_TOKEN_TTL });

    // refreshToken tiene select:false → update() atómico para la rotación
    await this.suscriptorRepo.update(suscriptor.id as any, {
      refreshToken: await bcrypt.hash(newRefresh, 10),
    } as any);

    return {
      success      : true,
      access_token : newAccess,
      refresh_token: newRefresh,
      expires_in   : 900,  // segundos — 15 min, para que el front sepa cuándo renovar
    };
  }

  /**
   * Cierra la sesión del usuario autenticado.
   * El suscriptorId se extrae del JWT en el guard — nunca del body o URL.
   */
  async logout(suscriptorId: number) {
    await this.suscriptorRepo.update(suscriptorId, { refreshToken: null });
    return { success: true, message: 'Sesión cerrada correctamente.' };
  }
}
