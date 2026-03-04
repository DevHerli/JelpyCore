import {
  Body,
  Controller,
  Post,
  Param,
  ParseIntPipe,
} from '@nestjs/common';

import { AuthService } from './auth.service';
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

  @Post('login-email')
  loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginEmail(dto);
  }

  @Post('send-otp-register')
  sendOtpRegister(@Body() dto: SendOtpRegisterDto) {
    return this.authService.sendOtpRegister(dto);
  }

  @Post('verify-otp-register')
  verifyOtpRegister(@Body() dto: VerifyOtpRegisterDto) {
    return this.authService.verifyOtpRegister(dto);
  }

  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('otp/email/send')
  sendOtpEmail(@Body() dto: SendOtpEmailDto) {
    return this.authService.sendOtpEmail(dto);
  }

  @Post('otp/email/check')
  checkOtpEmail(@Body() dto: CheckOtpEmailDto) {
    return this.authService.checkOtpEmail(dto);
  }

  @Post('otp/email/verify')
  verifyOtpEmail(@Body() dto: VerifyOtpEmailDto) {
    return this.authService.verifyOtpEmail(dto);
  }

  @Post('refresh')
  refresh(@Body('refresh_token') token: string) {
    return this.authService.refresh(token);
  }

  @Post('logout/:id')
  logout(@Param('id', ParseIntPipe) id: number) {
    return this.authService.logout(id);
  }
}