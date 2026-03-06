import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	Res
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequest } from './dto/register.dto';
import { LoginRequest } from './dto/login.dto';
import type { Request, Response } from 'express';
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { AuthResponse } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@ApiOperation({
		summary: 'Создание аккаунта',
		description: 'Создает новый аккаунт'
	})
	@ApiCreatedResponse({
		description: 'Аккаунт создан'
	})
	@ApiBadRequestResponse({
		description: 'Некорректный формат входных данных'
	})
	@ApiConflictResponse({
		description: 'Пользователь с таким email или ID существует'
	})
	@Post('register')
	@HttpCode(HttpStatus.CREATED)
	async register(@Body() dto: RegisterRequest) {
		return await this.authService.register(dto);
	}

	@ApiOperation({
		summary: 'Вход в систему',
		description: 'Выполняет вход в систему'
	})
	@ApiOkResponse({
		type: AuthResponse
	})
	@ApiBadRequestResponse({
		description: 'Некорректный формат входных данных'
	})
	@ApiNotFoundResponse({
		description: 'Пользователь не найден'
	})
	@Post('login')
	@HttpCode(HttpStatus.OK)
	async login(
		@Res({ passthrough: true }) res: Response,
		@Body() dto: LoginRequest
	) {
		return await this.authService.login(res, dto);
	}

	@ApiOkResponse({
		type: AuthResponse
	})
	@ApiUnauthorizedResponse({
		description: 'Недействительный refresh токен'
	})
	@ApiOperation({
		summary: 'Обновление токена'
	})
	@Post('refresh')
	@HttpCode(HttpStatus.OK)
	async refresh(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response
	) {
		return await this.authService.refresh(req, res);
	}

	@ApiOperation({
		summary: 'Выход из системы'
	})
	@ApiOkResponse({
		description: 'Возвращает true'
	})
	@Post('logout')
	@HttpCode(HttpStatus.OK)
	async logout(@Res({ passthrough: true }) res: Response) {
		return await this.authService.logout(res);
	}

	//test
	// @Authorization()
	// @Get('me')
	// @HttpCode(HttpStatus.OK)
	// async me(@Req() req: Request) {
	// 	return req.user;
	// }
}
