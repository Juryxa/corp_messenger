import { ApiProperty } from '@nestjs/swagger';

export class AuthResponse {
	@ApiProperty({
		description: 'JWT access token',
		example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpX...'
	})
	accessToken: string;
}
