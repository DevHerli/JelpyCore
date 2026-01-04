import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
  imports: [ConfigModule],   // para inyectar ConfigService dentro de MailService
  providers: [MailService],
  exports: [MailService],    // clave: exportarlo para que AuthModule lo pueda usar
})
export class MailModule {}
