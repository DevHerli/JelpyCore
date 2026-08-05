import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LegalController } from './legal.controller';

@Module({
  imports: [ConfigModule],
  controllers: [LegalController],
})
export class LegalModule {}
