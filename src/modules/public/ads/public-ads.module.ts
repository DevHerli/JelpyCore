import { Module } from '@nestjs/common';
import { AnunciosModule } from '../../business/anuncios/anuncios.module';
import { PublicAdsController } from './public-ads.controller';

@Module({
  imports: [AnunciosModule],
  controllers: [PublicAdsController],
})
export class PublicAdsModule {}
