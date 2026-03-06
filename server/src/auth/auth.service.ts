import {
	ConflictException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterRequest } from './dto/register.dto';
import { hash, verify } from 'argon2';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from './interfaces/jwt.interface';
import type { StringValue } from 'ms';
import { LoginRequest } from './dto/login.dto';
import type { Request, Response } from 'express';
import { isDev } from '../utils/is-dev.util';
import { refreshConvertToMs } from '../utils/refresh-convert-to-ms.util';

type Role = 'admin' | 'user';

@Injectable()
export class AuthService {
	private readonly JWT_ACCESS_TOKEN_TTL: StringValue;
	private readonly JWT_REFRESH_TOKEN_TTL: StringValue;

	private readonly COOKIE_DOMAIN: string;

	constructor(
		private readonly prismaService: PrismaService,
		private readonly configService: ConfigService,
		private readonly jwtService: JwtService
	) {
		this.JWT_ACCESS_TOKEN_TTL = configService.getOrThrow<StringValue>(
			'JWT_ACCESS_TOKEN_TTL'
		);
		this.JWT_REFRESH_TOKEN_TTL = configService.getOrThrow<StringValue>(
			'JWT_REFRESH_TOKEN_TTL'
		);

		this.COOKIE_DOMAIN = configService.getOrThrow<string>('COOKIE_DOMAIN');
	}

	//регистрация
	async register(dto: RegisterRequest) {
		const { name, surname, email, password, role, employee_Id } = dto;

		const existUserEmail = await this.prismaService.user.findUnique({
			where: {
				email
			}
		});
		const existUserEmployeeId = await this.prismaService.user.findUnique({
			where: {
				employee_Id
			}
		});

		if (existUserEmail) {
			throw new ConflictException(
				'Пользователь с таким email существует'
			);
		}
		if (existUserEmployeeId) {
			throw new ConflictException('Пользователь с таким ID существует');
		}

		const user = await this.prismaService.user.create({
			data: {
				name,
				surname,
				email,
				password: await hash(password),
				employee_Id,
				role
			}
		});
		return this.generateTokens(user.id, user.role);
	}

	//логин
	async login(res: Response, dto: LoginRequest) {
		const { email, password, employee_Id } = dto;

		const user = await this.prismaService.user.findFirst({
			where: {
				OR: [{ email }, { employee_Id }]
			},
			select: {
				id: true,
				password: true,
				role: true
			}
		});

		if (!user) {
			throw new NotFoundException('Пользователь не найден');
		}

		const isValidPassword = await verify(user.password, password);

		if (!isValidPassword) {
			throw new NotFoundException('Пользователь не найден');
		}

		return this.auth(res, user.id, user.role);
	}

	//обновление токена
	async refresh(req: Request, res: Response) {
		const refreshToken = req.cookies['refreshToken'];

		if (!refreshToken) {
			throw new UnauthorizedException('Недействительный refresh токен');
		}

		const payload: JwtPayload =
			await this.jwtService.verifyAsync(refreshToken);

		if (payload) {
			const user = await this.prismaService.user.findUnique({
				where: {
					id: payload.id
				},
				select: {
					id: true,
					role: true
				}
			});
			if (!user) {
				throw new NotFoundException('Пользователь не найден');
			}

			return this.auth(res, user.id, user.role);
		}
	}

	async logout(res: Response) {
		this.setCookie(res, 'refreshToken', new Date(0));
		return true;
	}

	async validate(id: string) {
		const user = await this.prismaService.user.findUnique({
			where: {
				id
			}
		});

		if (!user) {
			throw new NotFoundException('Пользователь не найден');
		}
		return user;
	}

	//приватный метод на авторизацию, раздаются токены и устанавливаются куки
	private auth(res: Response, id: string, role: Role) {
		const { accessToken, refreshToken } = this.generateTokens(id, role);

		const refreshTTLMs = refreshConvertToMs(this.configService);
		this.setCookie(res, refreshToken, new Date(Date.now() + refreshTTLMs));

		return accessToken;
	}

	private generateTokens(id: string, role: Role) {
		const payload: JwtPayload = { id, role };

		const accessToken = this.jwtService.sign(payload, {
			expiresIn: this.JWT_ACCESS_TOKEN_TTL
		});

		const refreshToken = this.jwtService.sign(payload, {
			expiresIn: this.JWT_REFRESH_TOKEN_TTL
		});
		return { accessToken, refreshToken };
	}

	private setCookie(res: Response, value: string, expires: Date) {
		res.cookie('refreshToken', value, {
			httpOnly: true,
			domain: this.COOKIE_DOMAIN,
			expires,
			secure: !isDev(this.configService),
			sameSite: !isDev(this.configService) ? 'none' : 'lax'
		});
	}
}
