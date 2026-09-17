import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataRetentionService } from './data-retention.service';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';
import { RefreshSession } from '../../auth/entities/refresh-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Suscriptor, RefreshSession])],
  providers: [DataRetentionService],
})
export class DataRetentionModule {}
