import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ciudad } from './entities/ciudades.entity';
import { CiudadesService } from './ciudades.service';
import { CiudadesController } from './ciudades.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ciudad])],
  controllers: [CiudadesController],
  providers: [CiudadesService],
  exports: [CiudadesService],
})
export class CiudadesModule {}
