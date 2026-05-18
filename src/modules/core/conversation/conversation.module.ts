import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConversationSession } from './entities/conversation-session.entity';
import { ConversationTurn } from './entities/conversation-turn.entity';
import { ConversationService } from './conversation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConversationSession, ConversationTurn]),
  ],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
