import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';

export function getJwtConfig(configService: ConfigService): JwtModuleOptions {
	const privateKeyPath = path.resolve(
		configService.getOrThrow<string>('PRIVATE_KEY_PATH')
	);
	const publicKeyPath = path.resolve(
		configService.getOrThrow<string>('PUBLIC_KEY_PATH')
	);

	return {
		privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
		publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
		signOptions: {
			algorithm: 'RS256'
		},
		verifyOptions: {
			algorithms: ['RS256'],
			ignoreExpiration: false
		}
	};
}
