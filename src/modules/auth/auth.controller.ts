/**
 * AuthController — JLP-015 / B6
 *
 * Rate limits por endpoint (complementan el global 120 req/min de ThrottlerModule):
 *
 *   send-otp / send-otp-register / otp/email/send  → 5 intentos / 10 min
 *     Evita flood de SMS/email y agotamiento de cuota de proveedor.
 *
 *   login-email / verify-otp / verify-otp-register → 10 intentos / 5 min
 *     Frena ataques de fuerza bruta de credenciales.
 *
 *   refresh                                        → 30 intentos / 5 min
 *     Permite renovación frecuente sin abrir DoS en el endpoint de rotación.
 *
 * ttl en @nestjs/throttler v6 se expresa en SEGUNDOS.
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { SendOtpRegisterDto } from './dtos/send-otp-register.dto';
import { VerifyOtpRegisterDto } from './dtos/verify-otp-register.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { LoginEmailDto } from './dtos/login-email.dto';
import { SendOtpEmailDto } from './dtos/send-otp-email.dto';
import { VerifyOtpEmailDto } from './dtos/verify-otp-email.dto';
import { CheckOtpEmailDto } from './dtos/check-otp-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Registro por OTP (teléfono) ──────────────────────────────────────────

  /** 5 intentos cada 10 minutos — limita flood de OTP y abuso de cuota SMS */
  @Post('send-otp-register')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 600 } })
  sendOtpRegister(@Body() dto: SendOtpRegisterDto) {
    return this.authService.sendOtpRegister(dto);
  }

  /** 10 intentos cada 5 minutos — frena fuerza bruta de códigos OTP */
  @Post('verify-otp-register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 300 } })
  verifyOtpRegister(@Body() dto: VerifyOtpRegisterDto) {
    return this.authService.verifyOtpRegister(dto);
  }

  // ── Login por OTP (teléfono) ─────────────────────────────────────────────

  /** 5 intentos cada 10 minutos */
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 600 } })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  /** 10 intentos cada 5 minutos */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 300 } })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // ── Login por email + contraseña ─────────────────────────────────────────

  /** 10 intentos cada 5 minutos — frena credential stuffing */
  @Post('login-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 300 } })
  loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginEmail(dto);
  }

  // ── Recuperación de contraseña por OTP (email) ───────────────────────────

  /** 5 intentos cada 10 minutos */
  @Post('otp/email/send')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 600 } })
  sendOtpEmail(@Body() dto: SendOtpEmailDto) {
    return this.authService.sendOtpEmail(dto);
  }

  @Post('otp/email/check')
  @HttpCode(HttpStatus.OK)
  checkOtpEmail(@Body() dto: CheckOtpEmailDto) {
    return this.authService.checkOtpEmail(dto);
  }

  @Post('otp/email/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtpEmail(@Body() dto: VerifyOtpEmailDto) {
    return this.authService.verifyOtpEmail(dto);
  }

  // ── Gestión de sesión ────────────────────────────────────────────────────

  /**
   * Renueva el access token usando el refresh token.
   * Aplica rotación: el refresh anterior queda inválido tras este llamado.
   *
   * 30 intentos cada 5 minutos — permite renovación frecuente en apps activas
   * sin abrir un vector de DoS en el endpoint de rotación.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 300 } })
  refresh(@Body('refresh_token') token: string) {
    return this.authService.refresh(token);
  }

  /**
   * Cierra la sesión del usuario autenticado.
   * Revoca el refresh token en servidor — no acepta :id en la URL
   * para evitar que un usuario cierre la sesión de otro.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Request() req: any) {
    return this.authService.logout(req.user.sub);
  }
}
