import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogoProductosService } from './catalogo-productos.service';
import { CatalogoProductosController } from './catalogo-productos.controller';

// Entidades
import { CategoriaCatalogo } from './entities/categoria-catalogo.entity';
import { ItemNegocio } from './entities/item-negocio.entity';
import { ItemSucursal } from './entities/item-sucursal.entity';
import { Negocio } from '../negocios/entities/negocio.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CategoriaCatalogo, ItemNegocio, ItemSucursal, Negocio])
  ],
  controllers: [CatalogoProductosController],
  providers: [CatalogoProductosService],
  exports: [CatalogoProductosService] // Por si otro módulo lo necesita
})
export class CatalogoProductosModule {}