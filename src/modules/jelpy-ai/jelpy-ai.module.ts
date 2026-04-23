import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JelpyAiService } from './jelpy-ai.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get<string>('JELPY_AI_URL'),
        timeout: 5000,
      }),
    }),
  ],
  providers: [JelpyAiService],
  exports: [JelpyAiService],
})
export class JelpyAiModule {}