import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromocionFavorito } from './entities/promocion-favorito.entity';
import { PromocionesFavoritosService } from './promociones-favoritos.service';
import { PromocionesFavoritosController } from './promociones-favoritos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PromocionFavorito])],
  controllers: [PromocionesFavoritosController],
  providers: [PromocionesFavoritosService],
  exports: [PromocionesFavoritosService],
})
export class PromocionesFavoritosModule {}
