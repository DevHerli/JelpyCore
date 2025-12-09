import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicidadChat } from './entities/publicidad-chat.entity';
import { PublicidadChatService } from './publicidad-chat.service';
import { PublicidadChatController } from './publicidad-chat.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PublicidadChat])],
  providers: [PublicidadChatService],
  controllers: [PublicidadChatController],
  exports: [PublicidadChatService], 
})
export class PublicidadChatModule {}
