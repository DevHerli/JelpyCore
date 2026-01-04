import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SucursalLike } from './entities/sucursal-like.entity';
import { SucursalLikesService } from './sucursal-likes.service';
import { SucursalLikesController } from './sucursal-likes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SucursalLike])],
  providers: [SucursalLikesService],
  controllers: [SucursalLikesController],
  exports: [SucursalLikesService],
})
export class SucursalLikesModule {}
