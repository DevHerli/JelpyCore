import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EspecialidadesService } from './especialidades.service';
import { EspecialidadesController } from './especialidades.controller';
import { Especialidad } from './entities/especialidades.entity';
import { Subcategoria } from '../subcategorias/entities/subcategorias.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Especialidad, Subcategoria]),
  ],
  controllers: [EspecialidadesController],
  providers: [EspecialidadesService],
  exports: [EspecialidadesService],
})
export class EspecialidadesModule {}
