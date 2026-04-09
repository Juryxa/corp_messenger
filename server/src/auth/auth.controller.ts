import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';
import {AuthService} from './auth.service';
import {RegisterRequest} from './dto/register.dto';
import {LoginRequest} from './dto/login.dto';
import {ChangePasswordDto} from './dto/change-password.dto';
import type {Request, Response} from 'express';
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiConflictResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {AuthResponse} from './dto/auth.dto';
import {SkipThrottle, Throttle} from '@nestjs/throttler';
import {CurrentUser} from '../users/decorators/current-user.decorator';
import {AdminAuthorization, Authorization} from './decorators/authorization.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // ─── Регистрация ─────────────────────────────────────────────

    @ApiOperation({
        summary: 'Создание аккаунта',
        description: 'Только для администраторов. Генерирует одноразовый пароль для нового сотрудника.',
    })
    @ApiCreatedResponse({
        description: 'Аккаунт создан, возвращает одноразовый пароль',
        schema: {
            example: {
                userId: 'uuid',
                temporaryPassword: 'a3f9c2d1',
                message: 'Передайте этот пароль сотруднику.',
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Некорректный формат входных данных' })
    @ApiConflictResponse({ description: 'Пользователь с таким email или ID существует' })
    // @ApiUnauthorizedResponse({ description: 'Требуется авторизация администратора' })
    // @ApiBearerAuth()
    // @AdminAuthorization()
    @Post('register')
    @Throttle({ short: { ttl: 60000, limit: 10 } })
    @HttpCode(HttpStatus.CREATED)
    async register(@Body() dto: RegisterRequest) {
        return this.authService.register(dto);
    }

    // ─── Логин ───────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Вход в систему',
        description: 'Принимает email или ID сотрудника + пароль. Возвращает access токен, refresh токен устанавливается в httpOnly куку.',
    })
    @ApiOkResponse({
        type: AuthResponse,
        description: 'Успешный вход',
    })
    @ApiBadRequestResponse({ description: 'Некорректный формат входных данных' })
    @ApiNotFoundResponse({ description: 'Пользователь не найден' })
    @ApiBody({
        type: LoginRequest,
        examples: {
            byEmail: {
                summary: 'Вход по email',
                value: { email: 'slavasamokat@gmail.com', password: 'qwerty12' },
            },
            byEmployeeId: {
                summary: 'Вход по ID работника',
                value: { employee_Id: 1337, password: 'qwerty12' },
            },
        },
    })
    @Post('login')
    @Throttle({ short: { ttl: 60000, limit: 5 } })
    @HttpCode(HttpStatus.OK)
    async login(
        @Res({ passthrough: true }) res: Response,
        @Req() req: Request,
        @Body() dto: LoginRequest,
    ) {
        return this.authService.login(res, req, dto);
    }

    // ─── Обновление токена ───────────────────────────────────────

    @ApiOperation({
        summary: 'Обновление токена',
        description: 'Использует refresh токен из куки. Выполняет ротацию — старый токен инвалидируется.',
    })
    @ApiOkResponse({ type: AuthResponse })
    @ApiUnauthorizedResponse({ description: 'Недействительный или истёкший refresh токен' })
    @Post('refresh')
    @SkipThrottle()
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        const origin = req.headers.origin;
        const allowed = process.env.CORS_ALLOWED_ORIGINS
            ?.split(',')
            .map((o) => o.trim()) ?? [];

        if (!origin || !allowed.includes(origin)) {
            throw new UnauthorizedException('Недопустимый источник запроса');
        }

        return this.authService.refresh(req, res);
    }

    // ─── Выход ───────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Выход из системы',
        description: 'Удаляет текущую сессию и очищает куку.',
    })
    @ApiOkResponse({ description: 'Возвращает true' })
    @Post('logout')
    @SkipThrottle()
    @HttpCode(HttpStatus.OK)
    async logout(
        @Res({ passthrough: true }) res: Response,
        @Req() req: Request,
    ) {
        return this.authService.logout(res, req);
    }

    // ─── Смена пароля ────────────────────────────────────────────

    @ApiOperation({
        summary: 'Смена пароля',
        description: 'При смене пароля все остальные сессии инвалидируются. Обязательно при первом входе.',
    })
    @ApiOkResponse({ type: AuthResponse, description: 'Пароль изменён, возвращает новый access токен' })
    @ApiBadRequestResponse({ description: 'Некорректный формат входных данных' })
    @ApiUnauthorizedResponse({ description: 'Неверный текущий пароль' })
    @ApiBearerAuth()
    @Authorization()
    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    async changePassword(
        @Body() dto: ChangePasswordDto,
        @CurrentUser() user: { id: string },
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        return this.authService.changePassword(user.id, dto.oldPassword, dto.newPassword, res, req);
    }

    // ─── Сессии ──────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Получить активные сессии',
        description: 'Возвращает список активных сессий текущего пользователя. Текущая сессия помечается флагом isCurrent.',
    })
    @ApiOkResponse({
        description: 'Список сессий',
        schema: {
            example: [{
                id: 'uuid',
                userAgent: 'Chrome 120 / Windows',
                ip: '192.168.1.1',
                createdAt: '2024-01-01T00:00:00.000Z',
                expiresAt: '2024-01-02T00:00:00.000Z',
                isCurrent: true,
            }],
        },
    })
    @ApiBearerAuth()
    @Authorization()
    @Get('sessions')
    async getSessions(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        return this.authService.getSessions(user.id, req);
    }

    @ApiOperation({
        summary: 'Удалить конкретную сессию',
        description: 'Завершает выбранную сессию. Нельзя удалить текущую сессию — используй logout.',
    })
    @ApiOkResponse({ description: 'Возвращает true' })
    @ApiNotFoundResponse({ description: 'Сессия не найдена' })
    @ApiParam({ name: 'id', description: 'ID сессии' })
    @ApiBearerAuth()
    @Authorization()
    @Delete('sessions/:id')
    async deleteSession(
        @Param('id') sessionId: string,
        @CurrentUser() user: { id: string },
    ) {
        return this.authService.deleteSession(user.id, sessionId);
    }

    @ApiOperation({
        summary: 'Завершить все остальные сессии',
        description: 'Удаляет все сессии кроме текущей.',
    })
    @ApiOkResponse({ description: 'Возвращает true' })
    @ApiBearerAuth()
    @Authorization()
    @Delete('sessions')
    async deleteAllSessions(
        @CurrentUser() user: { id: string },
        @Req() req: Request,
    ) {
        return this.authService.deleteAllSessions(user.id, req);
    }

    @ApiOperation({
        summary: 'Отключить все сессии пользователя',
        description: 'Только для админов. Удаляет все refresh-сессии выбранного пользователя.',
    })
    @ApiOkResponse({ description: 'Возвращает true' })
    @ApiBearerAuth()
    @AdminAuthorization()
    @Delete('sessions/user/:userId')
    async deleteAllSessionsByUser(
        @Param('userId') userId: string,
    ) {
        return this.authService.deleteAllSessionsByUser(userId);
    }
}