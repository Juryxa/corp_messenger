import {Module} from '@nestjs/common';
import {ChatController} from './chat.controller';
import {ChatService} from './chat.service';
import {ChatGateway} from './chat.gateway';
import {PrismaModule} from '../prisma/prisma.module';
import {JwtModule} from '@nestjs/jwt';
import {PrismaService} from "../prisma/prisma.service";

@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, PrismaService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}