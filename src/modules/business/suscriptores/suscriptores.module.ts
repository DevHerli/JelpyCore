import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuscriptoresController } from './suscriptores.controller';
import { SuscriptoresService } from './suscriptores.service';
import { Suscriptor } from './entities/suscriptores.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Suscriptor])],
  controllers: [SuscriptoresController],
  providers: [SuscriptoresService],
  exports: [SuscriptoresService],
})
export class SuscriptoresModule {}
