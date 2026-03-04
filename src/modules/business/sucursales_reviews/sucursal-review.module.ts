import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SucursalReview } from './entities/sucursal-review.entity';
import { SucursalReviewService } from './sucursal-review.service';
import { SucursalReviewController } from './sucursal-review.controller';
import { Suscriptor } from '../suscriptores/entities/suscriptores.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SucursalReview, Suscriptor])],
  controllers: [SucursalReviewController],
  providers: [SucursalReviewService],
  exports: [SucursalReviewService],
})
export class SucursalReviewModule {}
