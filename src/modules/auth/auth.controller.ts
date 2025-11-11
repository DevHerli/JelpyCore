import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpRegisterDto } from './dtos/send-otp-register.dto';
import { VerifyOtpRegisterDto } from './dtos/verify-otp-register.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Paso 1 — Recibir datos y enviar OTP
   */
  @Post('send-otp-register')
  async sendOtpRegister(@Body() dto: SendOtpRegisterDto) {
    return this.authService.sendOtpRegister(dto);
  }

  /**
   * Paso 2 — Verificar OTP y crear cuenta
   */
  @Post('verify-otp-register')
  async verifyOtpRegister(@Body() dto: VerifyOtpRegisterDto) {
    return this.authService.verifyOtpRegister(dto);
  }

    /**
   * POST /auth/send-otp
   * Envía el código OTP al número indicado
   */
    @Post('send-otp')
    async sendOtp(@Body() dto: SendOtpDto) {
      return this.authService.sendOtp(dto);
    }
  
    /**
     * POST /auth/verify-otp
     * Verifica el OTP, crea o recupera el suscriptor, y devuelve token JWT
     */
    @Post('verify-otp')
    async verifyOtp(@Body() dto: VerifyOtpDto) {
      return this.authService.verifyOtp(dto);
    }
}
