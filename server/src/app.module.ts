import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {ConfigModule} from '@nestjs/config';
import {PrismaModule} from './prisma/prisma.module';
import {AuthModule} from './auth/auth.module';
import {ChatModule} from './chat/chat.module';
import {CallModule} from './call/call.module';
import {ThrottlerGuard, ThrottlerModule} from "@nestjs/throttler";
import {APP_GUARD} from "@nestjs/core";
import {UsersModule} from './users/users.module';
import { SessionModule } from './session/session.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true
		}),
		ThrottlerModule.forRoot([
			{
				name: 'short',
				ttl: 1000,   // 1 секунда
				limit: 3,    // не более 3 запросов
			},
			{
				name: 'long',
				ttl: 60000,  // 1 минута
				limit: 100,  // не более 100 запросов
			},
		]),
		PrismaModule,
		AuthModule,
		ChatModule,
		CallModule,
		UsersModule,
		SessionModule
	],
	controllers: [AppController],
	providers: [AppService, {
		provide: APP_GUARD,
		useClass: ThrottlerGuard, // применяется ко всем роутам
	},]
})
export class AppModule {}
