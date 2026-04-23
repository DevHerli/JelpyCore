import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bookmark } from './entities/bookmark.entity';
import { BookmarksService } from './bookmarks.service';
import { BookmarksController } from './bookmarks.controller';
import { EventoNegocio } from '../eventos_negocios/entities/evento-negocio.entity';
import { LecturaEventoNegocio } from '../eventos_negocios/entities/lectura-evento-negocio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    Bookmark, 
    EventoNegocio,
    LecturaEventoNegocio,
  ])],
  controllers: [BookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
