import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';

export function refreshConvertToMs(configService: ConfigService) {
	const refreshTTL: StringValue = configService.getOrThrow(
		'JWT_REFRESH_TOKEN_TTL'
	);
	return ms(refreshTTL);
}
