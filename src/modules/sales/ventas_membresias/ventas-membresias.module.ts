import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VentaMembresia } from './entities/ventas-membresia.entity';
import { Membresia } from '../../business/membresias/entities/membresia.entity';
import { VentasMembresiasService } from './ventas-membresias.service';
import { VentasMembresiasController } from './ventas-membresias.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VentaMembresia, Membresia])],
  controllers: [VentasMembresiasController],
  providers: [VentasMembresiasService],
  exports: [VentasMembresiasService],
})
export class VentasMembresiasModule {}
