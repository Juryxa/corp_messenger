import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {ConfigModule} from '@nestjs/config';
import {PrismaModule} from './prisma/prisma.module';
import {AuthModule} from './auth/auth.module';
import {ChatModule} from './chat/chat.module';
import {ThrottlerGuard, ThrottlerModule} from "@nestjs/throttler";
import {APP_GUARD} from "@nestjs/core";
import {UsersModule} from './users/users.module';
import {SessionModule} from './session/session.module';
import {PollsModule} from './polls/polls.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true
		}),
		ThrottlerModule.forRoot([
			{
				name: 'short',
				ttl: 1000,
				limit: 3,
			},
			{
				name: 'long',
				ttl: 60000,
				limit: 100,
			},
		]),
		PrismaModule,
		AuthModule,
		ChatModule,
		UsersModule,
		SessionModule,
		PollsModule
	],
	controllers: [AppController],
	providers: [AppService, {
		provide: APP_GUARD,
		useClass: ThrottlerGuard,
	},]
})
export class AppModule {}
