import {Module} from '@nestjs/common';
import {PassportModule} from '@nestjs/passport';
import {JwtModule} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {AuthService} from './auth.service';
import {AuthController} from './auth.controller';
import {JwtStrategy} from './strategies/jwt.strategy';
import {PrismaModule} from '../prisma/prisma.module';
import {SessionGateway} from "../session/session.gateway";
import {SessionService} from "../session/session.service";
import {TotpService} from "../totp/totp.service";

@Module({
	imports: [
		PrismaModule,
		PassportModule,
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				signOptions: { algorithm: 'ES256' },
			}),
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy, SessionGateway, SessionService, TotpService],
	exports: [JwtStrategy],
})
export class AuthModule {}