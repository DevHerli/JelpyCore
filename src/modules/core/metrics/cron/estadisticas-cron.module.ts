import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadisticaHistorico } from '../estadistica-historico/entities/estadistica-historico.entity';
import { EstadisticasCronService } from './estadisticas-cron.service';
import { EstadisticasSemanalCronService } from './estadisticas-semanal-cron.service';

@Module({
  imports: [TypeOrmModule.forFeature([EstadisticaHistorico])],
  providers: [
    EstadisticasCronService,
    EstadisticasSemanalCronService
  ],
})
export class EstadisticasCronModule {}
