import {
  Body,
  Controller,
  Post,
  Param,
  ParseIntPipe,
  Get,
  UseGuards
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { SendOtpRegisterDto } from './dtos/send-otp-register.dto';
import { VerifyOtpRegisterDto } from './dtos/verify-otp-register.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { LoginEmailDto } from './dtos/login-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //Login con correo y contraseña
  @Post('login-email')
  loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginEmail(dto);
  }

  //Enviar OTP para registro por teléfono
  @Post('send-otp-register')
  sendOtpRegister(@Body() dto: SendOtpRegisterDto) {
    return this.authService.sendOtpRegister(dto);
  }

  //Verificar OTP del registro
  @Post('verify-otp-register')
  verifyOtpRegister(@Body() dto: VerifyOtpRegisterDto) {
    return this.authService.verifyOtpRegister(dto);
  }

  //Enviar OTP login por teléfono
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  //Verificar OTP login
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  //Refresh token
  @Post('refresh')
  refresh(@Body('refresh_token') token: string) {
    return this.authService.refresh(token);
  }

  //Logout
  @Post('logout/:id')
  logout(@Param('id', ParseIntPipe) id: number) {
    return this.authService.logout(id);
  }
}
