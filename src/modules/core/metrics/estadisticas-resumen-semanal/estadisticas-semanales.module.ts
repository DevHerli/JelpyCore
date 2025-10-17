import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadisticaResumenSemanal } from './entities/estadistica-resumen-semanal.entity';
import { EstadisticasSemanalesService } from './estadisticas-semanales.service';
import { EstadisticasSemanalesController } from './estadisticas-semanales.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EstadisticaResumenSemanal])],
  controllers: [EstadisticasSemanalesController],
  providers: [EstadisticasSemanalesService],
  exports: [EstadisticasSemanalesService],
})
export class EstadisticasSemanalesModule {}
