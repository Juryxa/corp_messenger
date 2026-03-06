import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { getSwaggerConfig } from '../config/swagger.config';

export function setupSwagger(app: INestApplication) {
	const config = getSwaggerConfig();

	const document = SwaggerModule.createDocument(app, config);

	SwaggerModule.setup('/docs', app, document, {
		jsonDocumentUrl: '/swagger.json',
		yamlDocumentUrl: '/swagger.yaml',
		customSiteTitle: 'API docs'
	});
}
