import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
	extends PrismaClient
	implements OnModuleInit, OnModuleDestroy
{
	constructor() {
		// 1. Создаем пул pg
		const pool = new Pool({ connectionString: process.env.DATABASE_URL });
		// 2. Создаем адаптер
		const adapter = new PrismaPg(pool);
		// 3. Передаем адаптер в PrismaClient
		super({ adapter });
	}
	async onModuleInit() {
		await this.$connect();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
