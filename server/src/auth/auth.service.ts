import {ConflictException, Injectable, NotFoundException, UnauthorizedException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {RegisterRequest} from './dto/register.dto';
import {hash, verify} from 'argon2';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import type {JwtPayload} from './interfaces/jwt.interface';
import type {StringValue} from 'ms';
import {LoginRequest} from './dto/login.dto';
import type {Request, Response} from 'express';
import {isDev} from '../utils/is-dev.util';
import {refreshConvertToMs} from '../utils/refresh-convert-to-ms.util';
import {randomBytes} from 'crypto';
import {UAParser} from 'ua-parser-js';
import {SessionService} from "../session/session.service";
import * as path from 'path';
import * as fs from 'fs';
import {TotpService} from "../totp/totp.service";

type Role = 'admin' | 'user';

@Injectable()
export class AuthService {
	private readonly JWT_ACCESS_TOKEN_TTL: StringValue;
	private readonly JWT_REFRESH_TOKEN_TTL: StringValue;
	private readonly COOKIE_DOMAIN: string;

	constructor(
		private readonly prismaService: PrismaService,
		private readonly configService: ConfigService,
		private readonly totpService: TotpService,
		private readonly jwtService: JwtService,
		private readonly sessionService: SessionService,
	) {
		this.JWT_ACCESS_TOKEN_TTL = configService.getOrThrow<StringValue>('JWT_ACCESS_TOKEN_TTL');
		this.JWT_REFRESH_TOKEN_TTL = configService.getOrThrow<StringValue>('JWT_REFRESH_TOKEN_TTL');
		this.COOKIE_DOMAIN = configService.getOrThrow<string>('COOKIE_DOMAIN');
	}

	// ─── Регистрация ─────────────────────────────────────────────

	async register(dto: RegisterRequest) {
		const { name, surname, email, role, employee_Id } = dto;

		const [existEmail, existId] = await Promise.all([
			this.prismaService.user.findUnique({ where: { email } }),
			this.prismaService.user.findUnique({ where: { employee_Id } }),
		]);

		if (existEmail) throw new ConflictException('Пользователь с таким email существует');
		if (existId) throw new ConflictException('Пользователь с таким ID существует');

		const temporaryPassword = randomBytes(6).toString('hex');

		const user = await this.prismaService.user.create({
			data: {
				name,
				surname,
				email,
				password: await hash(temporaryPassword),
				employee_Id,
				role,
				isTemporaryPassword: true,
			},
		});

		return {
			userId: user.id,
			temporaryPassword,
			name,
			surname,
			email,
			employee_Id,
			role,
			message: 'Передайте этот пароль сотруднику. Он будет действителен до первого входа.',
		};
	}

	// ─── Логин ───────────────────────────────────────────────────

	async login(res: Response, req: Request, dto: LoginRequest) {
		const { email, password, employee_Id } = dto;

		const where: { email?: string; employee_Id?: number }[] = [];
		if (email) where.push({ email });
		if (employee_Id) where.push({ employee_Id });

		const user = await this.prismaService.user.findFirst({
			where: { OR: where },
			select: {
				id: true,
				password: true,
				role: true,
				isTemporaryPassword: true,
				totpEnabled: true,
				totpSecret: true,
			},
		});

		if (!user) throw new NotFoundException('Пользователь не найден');

		const isValidPassword = await verify(user.password, password);
		if (!isValidPassword) throw new NotFoundException('Пользователь не найден');

		// Если TOTP включён — не выдаём токены сразу
		if (user.totpEnabled) {
			// Выдаём временный токен только для прохождения TOTP шага
			const tempToken = this.jwtService.sign(
				{ id: user.id, role: user.role, step: 'totp' },
				{ expiresIn: '5m', algorithm: 'ES256' },
			);
			return { requireTotp: true, tempToken };
		}

		const { accessToken } = await this.auth(res, req, user.id, user.role);
		return { accessToken, isTemporaryPassword: user.isTemporaryPassword };
	}

	// Новый метод — второй шаг входа с TOTP кодом
	async loginTotp(res: Response, req: Request, tempToken: string, code: string) {
		let payload: any;
		try {
			const publicKey = fs.readFileSync(
				path.resolve(this.configService.getOrThrow('PUBLIC_KEY_PATH')), 'utf8'
			);
			payload = await this.jwtService.verifyAsync(tempToken, {
				publicKey,
				algorithms: ['ES256'],
			});
		} catch {
			throw new UnauthorizedException('Недействительный временный токен');
		}

		if (payload.step !== 'totp') {
			throw new UnauthorizedException('Неверный тип токена');
		}

		const user = await this.prismaService.user.findUnique({
			where: { id: payload.id },
			select: { id: true, role: true, totpSecret: true, totpEnabled: true, isTemporaryPassword: true },
		});

		if (!user?.totpEnabled || !user.totpSecret) {
			throw new UnauthorizedException('TOTP не настроен');
		}

		const isValid = this.totpService.verify(user.totpSecret, code);
		if (!isValid) throw new UnauthorizedException('Неверный код 2FA');

		const { accessToken } = await this.auth(res, req, user.id, user.role);
		return { accessToken, user, isTemporaryPassword: user.isTemporaryPassword };
	}

	// ─── Смена пароля ────────────────────────────────────────────

	async changePassword(
		userId: string,
		oldPassword: string,
		newPassword: string,
		res: Response,
		req: Request,
	) {
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			select: { password: true, role: true },
		});

		if (!user) throw new NotFoundException('Пользователь не найден');

		const isValid = await verify(user.password, oldPassword);
		if (!isValid) throw new UnauthorizedException('Неверный текущий пароль');

		const currentRefreshToken = req.cookies['refreshToken'];

		// Инвалидируем все сессии кроме текущей
		await this.prismaService.session.deleteMany({
			where: {
				userId,
				refreshToken: { not: currentRefreshToken },
			},
		});

		await this.prismaService.user.update({
			where: { id: userId },
			data: {
				password: await hash(newPassword),
				isTemporaryPassword: false,
			},
		});

		return this.auth(res, req, userId, user.role);
	}

	// ─── Обновление токена ───────────────────────────────────────

	async refresh(req: Request, res: Response) {
		const refreshToken = req.cookies['refreshToken'];
		if (!refreshToken) throw new UnauthorizedException('Недействительный refresh токен');

		const session = await this.prismaService.session.findUnique({
			where: { refreshToken },
			include: { user: { select: { id: true, role: true } } },
		});

		// Сессия не найдена или истекла
		if (!session) throw new UnauthorizedException('Сессия истекла');

		if (session.expiresAt < new Date()) {
			await this.prismaService.session.deleteMany({ where: { refreshToken } });
			throw new UnauthorizedException('Сессия истекла');
		}

		// Ротация — удаляем старую сессию, создаём новую
		await this.prismaService.session.deleteMany({ where: { refreshToken } });

		return this.auth(res, req, session.user.id, session.user.role);
	}

	// ─── Выход ───────────────────────────────────────────────────

	async logout(res: Response, req: Request) {
		const refreshToken = req.cookies['refreshToken'];

		if (refreshToken) {
			await this.prismaService.session.deleteMany({ where: { refreshToken } });
		}

		this.setCookie(res, '', new Date(0));
		return true;
	}

	// ─── Сессии ──────────────────────────────────────────────────

	async getSessions(userId: string, req: Request) {
		const currentRefreshToken = req.cookies['refreshToken'];

		const sessions = await this.prismaService.session.findMany({
			where: { userId, expiresAt: { gt: new Date() } },
			orderBy: { createdAt: 'desc' },
		});

		return sessions.map((s) => ({
			id: s.id,
			userAgent: s.userAgent,
			ip: s.ip,
			createdAt: s.createdAt,
			expiresAt: s.expiresAt,
			isCurrent: s.refreshToken === currentRefreshToken,
		}));
	}

	async deleteSession(userId: string, sessionId: string) {
		const session = await this.prismaService.session.findUnique({
			where: { id: sessionId },
		});

		if (!session || session.userId !== userId) {
			throw new NotFoundException('Сессия не найдена');
		}

		await this.prismaService.session.delete({ where: { id: sessionId } });

		// 🔥 отправляем событие
		await this.sessionService.revokeSession(sessionId);

		return true;
	}

// auth.service.ts
	async deleteAllSessions(userId: string, req: Request) {
		const currentRefreshToken = req.cookies['refreshToken'];

		// Находим ID текущей сессии чтобы не трогать её
		const currentSession = await this.prismaService.session.findFirst({
			where: { refreshToken: currentRefreshToken },
		});

		// Получаем все сессии кроме текущей
		const sessionsToDelete = await this.prismaService.session.findMany({
			where: {
				userId,
				id: { not: currentSession?.id },
			},
		});

		await this.prismaService.session.deleteMany({
			where: {
				userId,
				refreshToken: { not: currentRefreshToken },
			},
		});

		// Шлём revoke только на удалённые сессии — не на текущую
		for (const session of sessionsToDelete) {
			await this.sessionService.revokeSession(session.id);
		}

		return true;
	}

	async deleteAllSessionsByUser(userId: string) {
		await this.prismaService.session.deleteMany({
			where: { userId },
		});
		await this.sessionService.revokeAllUserSessions(userId);
		return true;
	}

	// ─── Валидация для JWT стратегии ─────────────────────────────

	async validate(id: string) {
		const user = await this.prismaService.user.findUnique({ where: { id } });
		if (!user) throw new NotFoundException('Пользователь не найден');
		return user;
	}

	// ─── Приватные методы ────────────────────────────────────────

	private async auth(res: Response, req: Request, id: string, role: Role) {

		const user = await this.prismaService.user.findUnique({ where: { id } });
		if (!user) throw new NotFoundException('Пользователь не найден');

		const refreshTTLMs = refreshConvertToMs(this.configService);
		const expiresAt = new Date(Date.now() + refreshTTLMs);

		const ua = new UAParser(req.headers['user-agent'] ?? '').getResult();
		const userAgent = `${ua.browser.name ?? 'Unknown'} ${ua.browser.version ?? ''} / ${ua.os.name ?? 'Unknown'}`;
		const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

		// ✅ 1. создаём session СНАЧАЛА
		const session = await this.prismaService.session.create({
			data:{
				refreshToken: 'temp', // временно
				userAgent,
				ip,
				expiresAt,
				userId: id,
			}
		})

		// ✅ 2. генерируем токены с sessionId
		const { accessToken, refreshToken } = this.generateTokens(id, role, session.id);

		// ✅ 3. обновляем refreshToken в сессии
		await this.prismaService.session.update({
			where: { id: session.id },
			data: { refreshToken },
		});

		this.setCookie(res, refreshToken, expiresAt);

		return { accessToken, user };
	}

	private generateTokens(id: string, role: Role, sessionId: string) {
		const privateKey = fs.readFileSync(
			path.resolve(this.configService.getOrThrow('PRIVATE_KEY_PATH')),
			'utf8'
		);

		const payload: JwtPayload = { id, role, sessionId };

		const accessToken = this.jwtService.sign(payload, {
			privateKey,
			algorithm: 'ES256',
			expiresIn: this.JWT_ACCESS_TOKEN_TTL,
		});

		const refreshToken = this.jwtService.sign(payload, {
			privateKey,
			algorithm: 'ES256',
			expiresIn: this.JWT_REFRESH_TOKEN_TTL,
		});

		return { accessToken, refreshToken };
	}

	private setCookie(res: Response, value: string, expires: Date) {
		res.cookie('refreshToken', value, {
			httpOnly: true,
			domain: this.COOKIE_DOMAIN,
			expires,
			secure: !isDev(this.configService),
			sameSite: !isDev(this.configService) ? 'none' : 'lax',
		});
	}
}