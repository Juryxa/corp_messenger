import {Module} from '@nestjs/common';
import {CacheModule} from '@nestjs/cache-manager';
import {redisStore} from 'cache-manager-ioredis-yet';
import {ConfigService} from '@nestjs/config';

@Module({
    imports: [
        CacheModule.registerAsync({
            isGlobal: true,
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                store: await redisStore({
                    host: config.getOrThrow('REDIS_HOST'),
                    port: config.getOrThrow<number>('REDIS_PORT'),
                    ttl: 60,
                }),
            }),
        }),
    ],
})
export class RedisModule {}