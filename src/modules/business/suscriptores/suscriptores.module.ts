import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuscriptoresController } from './suscriptores.controller';
import { SuscriptoresService } from './suscriptores.service';
import { Suscriptor } from './entities/suscriptores.entity';
import { Membresia } from '../membresias/entities/membresia.entity';
import { MembresiasModule } from '../membresias/membresias.module';

@Module({
  imports: [TypeOrmModule.forFeature([Suscriptor,Membresia]),
  MembresiasModule,
],
  controllers: [SuscriptoresController],
  providers: [SuscriptoresService],
  exports: [SuscriptoresService],
})
export class SuscriptoresModule {}
