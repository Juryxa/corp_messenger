import {Module} from '@nestjs/common';
import {CallService} from './call.service';
import {CallGateway} from './call.gateway';
import {PrismaModule} from '../prisma/prisma.module';
import {JwtModule} from '@nestjs/jwt';

@Module({
  imports: [PrismaModule, JwtModule],
  providers: [CallService, CallGateway],
  exports: [CallService, CallGateway],
})
export class CallModule {}