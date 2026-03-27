import {Module} from '@nestjs/common';
import {PassportModule} from '@nestjs/passport';
import {JwtModule} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {AuthService} from './auth.service';
import {AuthController} from './auth.controller';
import {JwtStrategy} from './strategies/jwt.strategy';
import {PrismaModule} from '../prisma/prisma.module';
import * as path from 'path';
import * as fs from 'fs';

@Module({
	imports: [
		PrismaModule,
		PassportModule,
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => {
				const privateKey = fs.readFileSync(
					path.resolve(config.getOrThrow<string>('PRIVATE_KEY_PATH')),
					'utf8'
				);
				return {
					privateKey,
					signOptions: {
						algorithm: 'RS256',
					},
				};
			},
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy],
	exports: [JwtStrategy],
})
export class AuthModule {}