import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SupportTicket } from './entities/support-ticket.entity';
import { Negocio } from '../business/negocios/entities/negocio.entity';

import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket, Negocio]),

    // JWT con el mismo secret que AuthModule para verificar tokens existentes
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
