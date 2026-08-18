import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardsModule } from '../../../../common/guards/guards.module';
import { EstadisticaSucursalHistorico } from './entities/estadistica-sucursal-historico.entity';
import { EstadisticasSucursalesHistoricoService } from './estadisticas-sucursales-historico.service';
import { EstadisticasSucursalesHistoricoController } from './estadisticas-sucursales-historico.controller';

@Module({
  imports: [
    GuardsModule,
    TypeOrmModule.forFeature([EstadisticaSucursalHistorico]),
  ],
  controllers: [EstadisticasSucursalesHistoricoController],
  providers: [EstadisticasSucursalesHistoricoService],
  exports: [EstadisticasSucursalesHistoricoService],
})
export class EstadisticasSucursalesHistoricoModule {}
