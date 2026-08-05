import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataRetentionService } from './data-retention.service';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Suscriptor])],
  providers: [DataRetentionService],
})
export class DataRetentionModule {}
