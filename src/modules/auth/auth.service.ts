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
import { RefreshSession } from './entities/refresh-session.entity';
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

import { ESTADOS_SUSCRIPTOR } from '../../common/constants/estados.constants';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';

// ── Constantes de tiempo de vida de tokens ────────────────────────────────────
export const ACCESS_TOKEN_TTL  = '15m';   // corto por seguridad — el interceptor renueva
export const REFRESH_TOKEN_TTL = '30d';   // larga — rotación en cada uso
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// JLP-M28: máximo de intentos fallidos por código OTP antes de bloquearlo.
// Un código de 6 dígitos tiene 10^6 combinaciones; sin límite, con ventana de
// 5 min es forzable. Al 5º fallo el código se marca usado (hay que pedir otro).
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * JLP-M28: genera un OTP de 6 dígitos con CSPRNG (`crypto.randomInt`).
   * Reemplaza `Math.random()` (CWE-338): PRNG no criptográfico, predecible a
   * partir de salidas previas → riesgo de adivinar códigos / account takeover.
   * `randomInt(100000, 1000000)` cubre 100000–999999 de forma uniforme.
   */
  private generarCodigoOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * JLP-M28: busca el OTP activo más reciente para el identificador, aplica el
   * límite de intentos y valida el código en un solo lugar. En cada fallo
   * incrementa `intentos`; al alcanzar el máximo marca el código como usado
   * (bloqueo) para frenar fuerza bruta. Devuelve el OTP (sin marcar usado) si
   * el código es correcto; el caller decide cuándo consumirlo.
   */
  private async validarOtp(
    where: { telefonoCelular?: string; correoElectronico?: string },
    codigo: string,
  ): Promise<CodigoOtp> {
    const now = new Date();

    const otp = await this.otpRepo.findOne({
      where: { ...where, usado: false, expiracion: MoreThan(now) } as any,
      order: { id: 'DESC' } as any,
    });

    if (!otp) {
      throw new UnauthorizedException('Código inválido o expirado.');
    }

    if (otp.intentos >= MAX_OTP_ATTEMPTS) {
      otp.usado = true;
      await this.otpRepo.save(otp);
      throw new UnauthorizedException('Demasiados intentos. Solicita un nuevo código.');
    }

    if (otp.codigo !== codigo) {
      otp.intentos += 1;
      if (otp.intentos >= MAX_OTP_ATTEMPTS) {
        otp.usado = true; // bloquear el código tras el último intento fallido
      }
      await this.otpRepo.save(otp);
      throw new UnauthorizedException('Código inválido o expirado.');
    }

    return otp;
  }

  constructor(
    @InjectRepository(CodigoOtp)
    private readonly otpRepo: Repository<CodigoOtp>,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    @InjectRepository(RefreshSession)
    private readonly refreshSessionRepo: Repository<RefreshSession>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    private readonly mailService: MailService,
  ) {}

  /**
   * JLP-020: crea una fila de sesión (un refresh token por dispositivo/cliente)
   * en vez de sobrescribir la única columna `Suscriptor.refreshToken`. El
   * `jti` embebido en el JWT es la llave que `refresh()` usa para saber
   * exactamente qué sesión rotar o revocar, sin tocar las demás.
   */
  private async issueRefreshSession(
    suscriptorId: number,
    userAgent?: string | null,
  ): Promise<string> {
    const jti = randomUUID();
    const refreshToken = this.jwtService.sign(
      { sub: suscriptorId },
      { expiresIn: REFRESH_TOKEN_TTL, jwtid: jti },
    );

    await this.refreshSessionRepo.save(
      this.refreshSessionRepo.create({
        suscriptorId,
        jti,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        userAgent: userAgent ?? null,
        lastUsedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      }),
    );

    return refreshToken;
  }

  async loginEmail(dto: LoginEmailDto, userAgent?: string) {
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
    // JLP-020: sesión propia por dispositivo, no pisa la de otros clientes.
    const refreshToken = await this.issueRefreshSession(suscriptor.id, userAgent);

    await this.suscriptorRepo.update(suscriptor.id as any, {
      ultimoLogin: new Date(),
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
        role: suscriptor.role ?? 'user',
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

    const codigo = this.generarCodigoOtp(); // JLP-M28: CSPRNG
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    // JLP-M28: invalidar códigos activos anteriores → un solo OTP vigente por
    // teléfono (hace efectivo el límite de intentos, evita códigos huérfanos).
    await this.otpRepo
      .createQueryBuilder()
      .update(CodigoOtp)
      .set({ usado: true } as any)
      .where('telefono_celular = :tel', { tel: dto.telefonoCelular })
      .andWhere('usado = 0')
      .execute();

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
    // JLP-M28: validación con límite de intentos centralizada.
    const otp = await this.validarOtp(
      { telefonoCelular: dto.telefonoCelular },
      dto.codigo,
    );

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
      // Este alta (registro por OTP desde la app) nunca asignaba estado, por lo
      // que el suscriptor nacía con `estado_id` en NULL. Es el origen de los
      // registros 11, 12 y 13 de producción, que podían iniciar sesión pero no
      // tenían status. Se fija Activo del lado del servidor.
      estado: { id: ESTADOS_SUSCRIPTOR.ACTIVO } as any,
      registroCompleto: false,
      tieneNegocios: false,
    });

    const suscriptor = await this.suscriptorRepo.save(nuevo);

    return { success: true, message: 'Registro confirmado.', subscriber: suscriptor };
  }

  async sendOtp(dto: SendOtpDto) {
    const codigo = this.generarCodigoOtp(); // JLP-M28: CSPRNG
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    // JLP-M28: invalidar códigos activos anteriores para este teléfono.
    await this.otpRepo
      .createQueryBuilder()
      .update(CodigoOtp)
      .set({ usado: true } as any)
      .where('telefono_celular = :tel', { tel: dto.phoneNumber })
      .andWhere('usado = 0')
      .execute();

    await this.otpRepo.save(
      this.otpRepo.create({
        telefonoCelular: dto.phoneNumber,
        correoElectronico: null,
        codigo,
        expiracion,
      }),
    );

    // JLP-M28: no registrar el código OTP en logs (evita fuga de credenciales).
    return { success: true, message: 'OTP generado.' };
  }

  async verifyOtp(dto: VerifyOtpDto, userAgent?: string) {
    // JLP-M28: validación con límite de intentos centralizada.
    const otp = await this.validarOtp(
      { telefonoCelular: dto.phoneNumber },
      dto.code,
    );

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
          // Tercer camino de alta (login por OTP que crea la cuenta al vuelo).
          // También nacía sin estado; se fija Activo para no reintroducir NULLs.
          estado: { id: ESTADOS_SUSCRIPTOR.ACTIVO } as any,
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
      role: suscriptor.role ?? 'user',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    // JLP-020: sesión propia por dispositivo, no pisa la de otros clientes.
    const refreshToken = await this.issueRefreshSession(suscriptor.id, userAgent);

    return {
      success: true,
      message: 'OTP verificado.',
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
        role: suscriptor.role ?? 'user',
      },
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

    const codigo = this.generarCodigoOtp(); // JLP-M28: CSPRNG
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

    // JLP-M28: validación con límite de intentos centralizada. No se marca
    // usado: es un paso previo a verifyOtpEmail (reset de contraseña).
    await this.validarOtp({ correoElectronico }, codigo);

    return { success: true, message: 'Código válido.' };
  }

  async verifyOtpEmail(dto: VerifyOtpEmailDto) {
    const { correoElectronico, codigo, nuevaContrasena } = dto;

    if (!correoElectronico || !codigo || !nuevaContrasena) {
      throw new BadRequestException(
        'Correo, código y nueva contraseña son obligatorios.',
      );
    }

    // JLP-M28: validación con límite de intentos centralizada.
    const otp = await this.validarOtp({ correoElectronico }, codigo);

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

    const suscriptorId = decoded.sub;
    const jti: string | undefined = decoded.jti;

    // JLP-020: tokens emitidos ANTES de esta migración no traen `jti` en el
    // payload — se validan una última vez contra la columna legacy y se
    // "migran" a una fila de refresh_sessions, para no forzar un logout
    // masivo de todos los usuarios activos el día del deploy. Los tokens
    // nuevos (emitidos por login/refresh posteriores) siempre traen jti y
    // entran por la rama de abajo.
    if (!jti) {
      return this.refreshLegacy(suscriptorId, refreshToken);
    }

    // refresh_sessions.token_hash tiene select:false → addSelect para leerlo
    const session = await this.refreshSessionRepo
      .createQueryBuilder('rs')
      .addSelect('rs.tokenHash')
      .where('rs.jti = :jti', { jti })
      .getOne();

    // 2. Sesión desconocida (o de otro suscriptor) → rechazar sin afectar nada más
    if (!session || session.suscriptorId !== suscriptorId) {
      throw new UnauthorizedException('Sesión inválida. Inicia sesión de nuevo.');
    }

    if (session.revokedAt) {
      // Ya cerrada (logout, cambio de contraseña, o reuso detectado antes).
      // Solo se rechaza esta renovación — no hay nada más que revocar.
      this.logger.warn(
        `[JLP-001] Intento de renovar sesión ya revocada — sesión id=${session.id}, suscriptor id=${suscriptorId}.`,
      );
      throw new UnauthorizedException('Sesión revocada. Inicia sesión de nuevo.');
    }

    const isValid = await bcrypt.compare(refreshToken, session.tokenHash);

    if (!isValid) {
      // ── Detección de reuso (token rotation attack) ────────────────────────
      // El JWT es válido y su jti corresponde a una sesión conocida, pero el
      // hash ya fue rotado por un uso posterior de ESE MISMO refresh token →
      // reuso. A diferencia del esquema anterior (columna única), aquí solo
      // se revoca ESTA sesión — las demás sesiones/dispositivos del
      // suscriptor (p. ej. su otro celular o la web) NO se ven afectadas.
      this.logger.warn(
        `[JLP-001] Reuso de refresh token detectado — sesión id=${session.id}, suscriptor id=${suscriptorId}. Solo esa sesión fue revocada.`,
      );
      await this.refreshSessionRepo.update(session.id, { revokedAt: new Date() });
      throw new UnauthorizedException(
        'Sesión revocada por seguridad. Inicia sesión de nuevo.',
      );
    }

    const suscriptor = await this.suscriptorRepo.findOne({ where: { id: suscriptorId } as any });
    if (!suscriptor) {
      throw new UnauthorizedException('Sesión inválida. Inicia sesión de nuevo.');
    }

    // 3. Rotar EN LA MISMA fila: nuevo jti + nuevo hash (el token anterior queda inválido)
    const payload = {
      sub             : suscriptor.id,
      correo          : suscriptor.correoElectronico,
      nombre          : suscriptor.nombre,
      apellidoPaterno : suscriptor.apellidoPaterno,
      registroCompleto: suscriptor.registroCompleto,
      tieneNegocios   : suscriptor.tieneNegocios,
      role            : suscriptor.role ?? 'user',
    };

    const newJti     = randomUUID();
    const newAccess  = this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
    const newRefresh = this.jwtService.sign(
      { sub: suscriptor.id },
      { expiresIn: REFRESH_TOKEN_TTL, jwtid: newJti },
    );

    await this.refreshSessionRepo.update(session.id, {
      jti: newJti,
      tokenHash: await bcrypt.hash(newRefresh, 10),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return {
      success      : true,
      access_token : newAccess,
      refresh_token: newRefresh,
      expires_in   : 900,  // segundos — 15 min, para que el front sepa cuándo renovar
    };
  }

  /**
   * JLP-020: compatibilidad hacia atrás para refresh tokens emitidos ANTES de
   * la migración a `refresh_sessions` (no tienen `jti`). Se validan una única
   * vez contra la columna legacy `Suscriptor.refreshToken`; si coinciden, se
   * "migran" creando la primera fila de sesión para ese dispositivo. Esta
   * rama deja de recibir tráfico solo conforme expiren los últimos tokens
   * antiguos (máximo 30 días después del deploy de este cambio).
   */
  private async refreshLegacy(suscriptorId: number, refreshToken: string) {
    const suscriptor = await this.suscriptorRepo
      .createQueryBuilder('s')
      .addSelect('s.refreshToken')
      .where('s.id = :id', { id: suscriptorId })
      .getOne();

    if (!suscriptor || !suscriptor.refreshToken) {
      throw new UnauthorizedException('Sesión inválida. Inicia sesión de nuevo.');
    }

    const isValid = await bcrypt.compare(refreshToken, suscriptor.refreshToken);
    if (!isValid) {
      this.logger.warn(
        `[JLP-001] Reuso de refresh token legacy detectado — suscriptor id=${suscriptor.id}. Sesión legacy revocada.`,
      );
      await this.suscriptorRepo.update(suscriptor.id, { refreshToken: null });
      throw new UnauthorizedException(
        'Sesión revocada por seguridad. Inicia sesión de nuevo.',
      );
    }

    this.logger.log(
      `[JLP-020] Migrando sesión legacy a refresh_sessions — suscriptor id=${suscriptor.id}.`,
    );

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
    const newRefresh = await this.issueRefreshSession(suscriptor.id);

    // La columna legacy queda vacía: esta cuenta ya migró a refresh_sessions.
    await this.suscriptorRepo.update(suscriptor.id as any, { refreshToken: null } as any);

    return {
      success      : true,
      access_token : newAccess,
      refresh_token: newRefresh,
      expires_in   : 900,
    };
  }

  /**
   * Cierra TODAS las sesiones del usuario autenticado (todos sus
   * dispositivos). El suscriptorId se extrae del JWT en el guard — nunca del
   * body o URL. El front hoy no llama este endpoint (logout es local), pero
   * se deja correcto para cuando exista un botón "Cerrar sesión en todos
   * lados" o se decida llamarlo explícitamente.
   */
  async logout(suscriptorId: number) {
    await this.refreshSessionRepo.update({ suscriptorId }, { revokedAt: new Date() });
    await this.suscriptorRepo.update(suscriptorId, { refreshToken: null });
    return { success: true, message: 'Sesión cerrada correctamente.' };
  }
}
