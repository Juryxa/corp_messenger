import {Module} from '@nestjs/common';
import {SessionService} from './session.service';
import {SessionGateway} from './session.gateway';
import {PrismaModule} from "../prisma/prisma.module";
import {JwtModule} from "@nestjs/jwt";

@Module({
  imports: [PrismaModule, JwtModule],
  providers: [SessionGateway, SessionService],
  exports: [SessionGateway, SessionService],
})
export class SessionModule {}
