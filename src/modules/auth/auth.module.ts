import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CodigoOtp } from './entities/codigo-otp.entity';
import { Suscriptor } from '../business/suscriptores/entities/suscriptores.entity';
import { MailModule } from '../../common/mail/mail.module';

@Module({
  imports: [
    // Conexión de entidades al repositorio TypeORM
    TypeOrmModule.forFeature([CodigoOtp, Suscriptor]),

    // ConfigModule para leer variables de entorno (.env)
    ConfigModule,
    MailModule,

    // Registro asíncrono del módulo JWT con configuración dinámica
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Se obtiene la duración del token desde el .env o se usa '7d' por defecto
        const expiresInValue = config.get<string>('JWT_EXPIRES_IN') || '7d';

        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresInValue as any, // se fuerza el tipo correcto
          },
        };
      },
    }),
  ],

  // Providers (servicios disponibles en este módulo)
  providers: [AuthService],

  // Controladores del módulo
  controllers: [AuthController],
})
export class AuthModule {}
