import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardsModule } from '../../../../common/guards/guards.module';
import { EstadisticaHistoricoService } from './estadistica-historico.service';
import { EstadisticaHistoricoController } from './estadistica-historico.controller';
import { EstadisticaHistorico } from './entities/estadistica-historico.entity';
import { UserQueryHistory } from './entities/user-query-history.entity';

@Module({
  imports: [
    GuardsModule,
    TypeOrmModule.forFeature([EstadisticaHistorico, UserQueryHistory]),
  ],
  controllers: [EstadisticaHistoricoController],
  providers: [EstadisticaHistoricoService],
  exports: [EstadisticaHistoricoService],
})
export class EstadisticaHistoricoModule {}
