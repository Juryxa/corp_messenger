import {Module} from '@nestjs/common';
import {PollsController} from './polls.controller';
import {PollsService} from './polls.service';
import {PrismaModule} from '../prisma/prisma.module';
import {JwtModule} from "@nestjs/jwt";

@Module({
  imports: [PrismaModule, JwtModule],
  controllers: [PollsController],
  providers: [PollsService],
})
export class PollsModule {}