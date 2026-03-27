import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {ValidationPipe} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import {setupSwagger} from './utils/swagger.util';
import helmet from 'helmet';
import {ThrottlerExceptionFilter} from "./filters/throttler-exception.filter";


async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	app.use(cookieParser());

	app.use(helmet());

	app.useGlobalPipes(new ValidationPipe());

	app.setGlobalPrefix('api');

	app.useGlobalFilters(new ThrottlerExceptionFilter());

	app.enableCors({
		origin: process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()),
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
	})

	setupSwagger(app);

	await app.listen(process.env.PORT ?? 5000);
}

bootstrap();
