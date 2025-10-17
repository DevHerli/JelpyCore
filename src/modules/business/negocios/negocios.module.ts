import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Negocio } from './entities/negocio.entity';
import { NegociosService } from './negocios.service';
import { NegociosController } from './negocios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Negocio])],
  controllers: [NegociosController],
  providers: [NegociosService],
  exports: [NegociosService],
})
export class NegociosModule {}
