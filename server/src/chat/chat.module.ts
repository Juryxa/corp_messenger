import {Module} from '@nestjs/common';
import {ChatController} from './chat.controller';
import {ChatService} from './chat.service';
import {ChatGateway} from './chat.gateway';
import {PrismaModule} from '../prisma/prisma.module';
import {JwtModule} from '@nestjs/jwt';

@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}