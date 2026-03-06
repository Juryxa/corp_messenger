import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt.interface';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService
	) {
		const publicKeyPath = path.resolve(
			configService.getOrThrow<string>('PUBLIC_KEY_PATH')
		);
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: fs.readFileSync(publicKeyPath, 'utf8'),
			algorithms: ['RS256']
		});
	}

	async validate(payload: JwtPayload) {
		return await this.authService.validate(payload.id);
	}
}
