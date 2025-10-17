import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membresia } from './entities/membresia.entity';
import { MembresiasService } from './membresias.service';
import { MembresiasController } from './membresias.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Membresia])],
  controllers: [MembresiasController],
  providers: [MembresiasService],
  exports: [MembresiasService],
})
export class MembresiasModule {}
