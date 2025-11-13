import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository, MoreThan } from 'typeorm';
  import { CodigoOtp } from './entities/codigo-otp.entity';
  import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
  import { SendOtpRegisterDto } from './dtos/send-otp-register.dto';
  import { VerifyOtpRegisterDto } from './dtos/verify-otp-register.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { VerifyOtpDto } from './dtos/verify-otp.dto';
import { SendOtpDto } from './dtos/send-otp.dto';
import { Twilio } from 'twilio';
import { ConfigService } from '@nestjs/config';
  
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
  
    /**
     * Paso 1 — Recibir datos de registro y enviar OTP
     */
    // async sendOtpRegister(dto: SendOtpRegisterDto) {
    //   const { telefonoCelular } = dto;
    //   const existente = await this.suscriptorRepo.findOne({
    //     where: { telefonoCelular, eliminado: false },
    //   });
    //   if (existente) {
    //     throw new BadRequestException('El teléfono ya está registrado.');
    //   }
    //   const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    //   const expiracion = new Date(Date.now() + 5 * 60 * 1000); 
    //   const otp = this.otpRepo.create({
    //     telefonoCelular,
    //     codigo,
    //     expiracion,
    //     datosRegistro: dto,
    //   });
    //   await this.otpRepo.save(otp);
    //   console.log(`📱 OTP para ${telefonoCelular}: ${codigo}`);
  
    //   return {
    //     success: true,
    //     message: 'OTP enviado correctamente (simulado).',
    //   };
    // }

    async sendOtpRegister(dto: SendOtpRegisterDto) {
        const { telefonoCelular } = dto;
    
        // 1️⃣ Validar si el teléfono ya existe
        const existente = await this.suscriptorRepo.findOne({
          where: { telefonoCelular, eliminado: false },
        });
        if (existente) {
          throw new BadRequestException('El teléfono ya está registrado.');
        }
    
        // 2️⃣ Generar código OTP aleatorio
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expiracion = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    
        // 3️⃣ Guardar OTP con datos de registro
        const otp = this.otpRepo.create({
          telefonoCelular,
          codigo,
          expiracion,
          datosRegistro: dto,
        });
        await this.otpRepo.save(otp);
    
        // 4️⃣ Configurar Twilio
        const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
        const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
    
        console.log({
            accountSid,
            authToken,
            fromNumber,
          });
          
        if (!accountSid || !authToken || !fromNumber) {
          throw new BadRequestException(
            'Las credenciales de Twilio no están configuradas correctamente.',
          );
        }
    
        const client = new Twilio(accountSid, authToken);
    
        // 5️⃣ Enviar SMS real
        try {
          const numeroDestino = telefonoCelular.startsWith('+')
            ? telefonoCelular
            : `+52${telefonoCelular}`;
    
          await client.messages.create({
            body: `Tu código de verificación Jelpy es: ${codigo}`,
            from: fromNumber,
            to: numeroDestino,
          });
    
          return {
            success: true,
            message: 'OTP enviado correctamente por SMS.',
            telefono: numeroDestino,
          };
        } catch (error) {
          console.error('❌ Error al enviar SMS:', error.message || error);
          throw new BadRequestException('No se pudo enviar el código OTP.');
        }
      }
      
  
    /**
     * Paso 2 — Verificar OTP y crear suscriptor
     */
    async verifyOtpRegister(dto: VerifyOtpRegisterDto) {
      const { telefonoCelular, codigo } = dto;
      const now = new Date();
  
      // Buscar código válido y no usado
      const otp = await this.otpRepo.findOne({
        where: {
          telefonoCelular,
          codigo,
          usado: false,
          expiracion: MoreThan(now),
        },
        order: { creadoEn: 'DESC' },
      });
  
      if (!otp) {
        throw new UnauthorizedException('Código inválido o expirado.');
      }
  
      // Marcar OTP como usado
      otp.usado = true;
      await this.otpRepo.save(otp);
  
      const datos = otp.datosRegistro;
      if (!datos) {
        throw new BadRequestException(
          'No se encontraron los datos del registro en el OTP.',
        );
      }
  
      // Crear el suscriptor en base a los datos guardados
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
        message: 'Registro confirmado y suscriptor creado correctamente.',
        subscriber: suscriptor,
      };
    }




/**
   * Enviar código OTP
   */
async sendOtp(dto: SendOtpDto) {
    const { phoneNumber } = dto;

    if (!phoneNumber.match(/^[0-9]{10}$/)) {
      throw new BadRequestException('Número de teléfono inválido');
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000);

    const otp = this.otpRepo.create({
      telefonoCelular: phoneNumber,
      codigo,
      expiracion,
    });
    await this.otpRepo.save(otp);

    // 🔹 Modo real (SMS con Twilio)
    if (process.env.SEND_REAL_SMS === 'true') {
      const client = new Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );

      try {
        await client.messages.create({
          body: `Tu código de acceso a Jelpy es: ${codigo}. Expira en 5 minutos.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+52${phoneNumber}`, // México
        });
      } catch (error) {
        console.error('Error enviando SMS:', error.message);
        throw new BadRequestException('Error al enviar el SMS.');
      }

      console.log(`📲 OTP enviado vía SMS real a +52${phoneNumber}`);
    } else {
      // Modo simulado (solo consola)
      console.log(`OTP (simulado) para ${phoneNumber}: ${codigo}`);
    }

    return {
      success: true,
      message:
        process.env.SEND_REAL_SMS === 'true'
          ? 'OTP enviado vía SMS.'
          : 'OTP simulado (modo desarrollo).',
    };
  }

  /**
   * Verificar OTP y generar tokens
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const { phoneNumber, code } = dto;
    const now = new Date();

    const otp = await this.otpRepo.findOne({
      where: {
        telefonoCelular: phoneNumber,
        codigo: code,
        usado: false,
        expiracion: MoreThan(now),
      },
      order: { creadoEn: 'DESC' },
    });

    if (!otp) {
      throw new UnauthorizedException('Código inválido o expirado');
    }

    otp.usado = true;
    await this.otpRepo.save(otp);

    let suscriptor = await this.suscriptorRepo.findOne({
      where: { telefonoCelular: phoneNumber, eliminado: false },
    });

    if (!suscriptor) {
      suscriptor = this.suscriptorRepo.create({
        nombre: 'Pendiente',
        apellidoPaterno: 'Por registrar',
        telefonoCelular: phoneNumber,
        aceptoTerminos: false,
        registroCompleto: false,
        tieneNegocios: false,
        eliminado: false,
        ciudad: { id: 1 } as any, // puedes ajustar ciudad por defecto
      });
      suscriptor = await this.suscriptorRepo.save(suscriptor);
    }

// --- Crear payload JWT ---
const payload = {
  sub: suscriptor.id,
  telefono: suscriptor.telefonoCelular,
  nombre: suscriptor.nombre,
  apellidoPaterno: suscriptor.apellidoPaterno,
  registroCompleto: suscriptor.registroCompleto,
  tieneNegocios: suscriptor.tieneNegocios,
};


    // Access Token (válido 15 min)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // Refresh Token (válido 7 días)
    const refreshToken = this.jwtService.sign({ sub: suscriptor.id }, {
      expiresIn: '7d',
    });

    // Guardar versión cifrada del refresh token
    suscriptor.refreshToken = await bcrypt.hash(refreshToken, 10);
    await this.suscriptorRepo.save(suscriptor);

    return {
      success: true,
      message: 'OTP verificado correctamente.',
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }


    /**
   * Generar nuevo Access Token usando Refresh Token
   */
    async refresh(refreshToken: string) {
        if (!refreshToken) throw new UnauthorizedException('Falta refresh token');
    
        try {
          const decoded = this.jwtService.verify(refreshToken);
          const suscriptor = await this.suscriptorRepo.findOne({
            where: { id: decoded.sub },
          });
    
          if (!suscriptor || !suscriptor.refreshToken) {
            throw new UnauthorizedException('Refresh token inválido');
          }
    
          const isValid = await bcrypt.compare(refreshToken, suscriptor.refreshToken);
          if (!isValid) throw new UnauthorizedException('Refresh token no válido');
    
          const payload = {
            sub: suscriptor.id,
            telefono: suscriptor.telefonoCelular,
            nombre: suscriptor.nombre,
            apellidoPaterno: suscriptor.apellidoPaterno,
            registroCompleto: suscriptor.registroCompleto,
            tieneNegocios: suscriptor.tieneNegocios,
          };
          
          
    
          const newAccessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    
          return {
            success: true,
            access_token: newAccessToken,
          };
        } catch {
          throw new UnauthorizedException('Refresh token expirado o inválido');
        }
      }
    
      /**
       * Cerrar sesión (elimina refresh token)
       */
      async logout(userId: number) {
        await this.suscriptorRepo.update(userId, { refreshToken: null });
        return {
          success: true,
          message: 'Sesión cerrada correctamente.',
        };
      }


  }
  