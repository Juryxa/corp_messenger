import { DocumentBuilder } from '@nestjs/swagger';

export function getSwaggerConfig() {
	const config = new DocumentBuilder()
		.setTitle('Messenger API')
		.setDescription(
			'API для авторизации и аутентификации, обновление токенов'
		)
		.setVersion('1.0.0')
		.addBearerAuth()
		.build();
	return config;
}
