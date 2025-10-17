import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadisticaHistoricoService } from './estadistica-historico.service';
import { EstadisticaHistoricoController } from './estadistica-historico.controller';
import { EstadisticaHistorico } from './entities/estadistica-historico.entity';
import { UserQueryHistory } from './entities/user-query-history.entity';

@Module({
  imports: [
    // Registro de la entidad para poder usar Repository o DataSource
    TypeOrmModule.forFeature([EstadisticaHistorico, UserQueryHistory]),
  ],
  controllers: [EstadisticaHistoricoController],
  providers: [EstadisticaHistoricoService],
  exports: [EstadisticaHistoricoService], // por si lo usas en otros módulos (dashboard, reportes, etc.)
})
export class EstadisticaHistoricoModule {}
