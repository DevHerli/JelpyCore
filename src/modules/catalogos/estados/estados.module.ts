import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Estado } from './entities/estado.entity';
import { EstadosService } from './estados.service';
import { EstadosController } from './estados.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Estado])],
  controllers: [EstadosController],
  providers: [EstadosService],
  exports: [EstadosService],
})
export class EstadosModule {}
