import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReporteModeracion } from './entities/reporte-moderacion.entity';
import { ReportesModeracionController } from './reportes-moderacion.controller';
import { ReportesModeracionService } from './reportes-moderacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReporteModeracion])],
  controllers: [ReportesModeracionController],
  providers: [ReportesModeracionService],
  exports: [ReportesModeracionService],
})
export class ReportesModeracionModule {}
